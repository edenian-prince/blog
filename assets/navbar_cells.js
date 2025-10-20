document.addEventListener("DOMContentLoaded", function () {
    
    
    const nav = document.querySelector("nav.navbar");
    if (!nav) return;

    const width = nav.clientWidth;
    const height = nav.clientHeight;
    const padding = 5;
    const clusterPadding = 20;
    const numClusters = 6;
    const maxRadius = 10;

    const color = d3.scaleOrdinal(d3.schemeCategory10);
    const radiusScale = d3.scaleLinear().domain([0,10]).range([3,maxRadius]);
    // Generate nodes
    const noClusterNodes = d3.range(50).map((idx) => ({
      id: idx,
      cluster: 0,
      radius: 3,
      x: Math.random() * width,
      y: Math.random() * height
    }));

    const clusterNodes = d3.range(50).map((idx) => {
      const i = Math.floor(Math.random() * numClusters);
      const r = Math.sqrt((i + 1) / numClusters * -Math.log(Math.random())) * maxRadius;
      return {
        id: idx + 50,
        cluster: i + 1,
        radius: radiusScale(r),
        x: Math.random() * width,
        y: Math.random() * height
      };
    });

    const nodes = noClusterNodes.concat(clusterNodes);

    // Determine representative node for each cluster
    const clusters = {};
    nodes.forEach(n => {
      if (n.cluster !== 0) {
        if (!clusters[n.cluster] || (n.radius > clusters[n.cluster].radius)) {
          clusters[n.cluster] = n;
        }
      }
    });

    // Force functions
    function cluster(alpha) {
      return function (d) {
        if (d.cluster === 0) return;
        const cluster = clusters[d.cluster];
        if (!cluster || cluster === d) return;

        let x = d.x - cluster.x;
        let y = d.y - cluster.y;
        let l = Math.sqrt(x * x + y * y);
        const r = d.radius + cluster.radius + clusterPadding;
        if (l !== r) {
          l = (l - r) / l * alpha;
          d.x -= x *= l;
          d.y -= y *= l;
          cluster.x += x;
          cluster.y += y;
        }
      };
    }

    function collide(alpha) {
      const quadtree = d3.quadtree()
        .x(d => d.x)
        .y(d => d.y)
        .addAll(nodes);

      return function (d) {
        const r = d.radius + maxRadius + Math.max(padding, clusterPadding);
        const nx1 = d.x - r,
              nx2 = d.x + r,
              ny1 = d.y - r,
              ny2 = d.y + r;

        quadtree.visit(function (quad, x1, y1, x2, y2) {
          const data = quad.data;
          if (data && data !== d) {
            let x = d.x - data.x;
            let y = d.y - data.y;
            let l = Math.sqrt(x * x + y * y);
            const r = d.radius + data.radius + (d.cluster === data.cluster ? padding : clusterPadding);
            if (l < r) {
              l = (l - r) / l * alpha;
              d.x -= x *= l;
              d.y -= y *= l;
              data.x += x;
              data.y += y;
            }
          }
          return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        });
      };
    }

    function hullPoints(data) {
      let pointArr = [];
      const padding = 2.5;
      data.each(d => {
        const pad = d.radius + padding;
        pointArr = pointArr.concat([
          [d.x - pad, d.y - pad],
          [d.x - pad, d.y + pad],
          [d.x + pad, d.y - pad],
          [d.x + pad, d.y + pad]
        ]);
      });
      return pointArr;
    }
    // const svgWidth = nav.clientWidth * 0.6; // 60% width for clusters area
    // const svgHeight = nav.clientHeight * 0.8; // 80% height, leave some padding


    // SVG and visuals
    const svg = d3.select(nav)
      .append("svg")
      .attr("id", "chart")
      .attr("width", width)
      .attr("height", height)
      .style("position", "absolute")
      .style("top", 0)
        .style("left", "50px")
        .style("pointer-events", "none")
        .style("z-index", 0);  // or some value higher than navbar buttons


    const line = d3.line().curve(d3.curveBasisClosed);

    const hullG = svg.append("g").attr("class", "hulls");
    const nodeG = svg.append("g").attr("class", "nodes");

    const node = nodeG.selectAll("circle")
      .data(nodes, d => d.id)
      .enter().append("circle")
      .attr("class", d => `cluster${d.cluster}`)
      .attr("r", d => d.radius)
      .attr("fill", d => color(d.cluster))
      .style("pointer-events", "auto")  // enable pointer events on circles only
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    const hulls = hullG.selectAll("path")
      .data(Object.keys(clusters).map(c => {
        return {
          cluster: c,
          nodes: node.filter(d => d.cluster == c)
        };
      }), d => d.cluster)
      .enter().append("path")
      .attr("d", d => line(d3.polygonHull(hullPoints(d.nodes))))
      .attr("fill", d => color(d.cluster))
      .attr("opacity", 0.4)
      .style("pointer-events", "auto");

    const simulation = d3.forceSimulation(nodes)
      .alpha(0.3)
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(d => d.radius + padding))
      .on("tick", ticked);

    let showCells = true;

    function ticked() {
      node
        .each(cluster(0.2))
        .each(collide(0.1))
        .attr("cx", d => d.x = Math.max(d.radius, Math.min(width - d.radius, d.x)))
        .attr("cy", d => d.y = Math.max(d.radius, Math.min(height - d.radius, d.y)));

      hulls
        .attr("d", d => line(d3.polygonHull(hullPoints(d.nodes))));
    }

    d3.select("#updateButton").on("click", () => {
      showCells = !showCells;

      const useNodes = showCells
        ? nodes
        : nodes.map(d => ({ ...d, radius: 3, cluster: 0 }));

      simulation
        .nodes(useNodes)
        .force("collide", d3.forceCollide(d => d.radius + padding))
        .alpha(0.1)
        .restart();

      node
        .data(useNodes, d => d.id)
        .transition()
        .duration(1000)
        .attr("class", d => `cluster${d.cluster}`)
        .attr("r", d => d.radius)
        .attr("fill", d => color(d.cluster));

      hulls
        .transition()
        .duration(1000)
        .attr("opacity", showCells ? 0.4 : 0);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.1).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }


});