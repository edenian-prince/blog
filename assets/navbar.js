document.addEventListener("DOMContentLoaded", function () {
  const nav = document.querySelector("nav.navbar");
  if (!nav) return;

  const width = nav.clientWidth;
  const height = nav.clientHeight;
  const smooth = true;
  const nodes = [];

  const radius = Math.min(width, height) / 2 - 20;

  const repeller = {
    id: "mouse",
    x: width / 2,
    y: height / 2,
    fx: width / 2,
    fy: height / 2
  };
  nodes.push(repeller);

  const svg = d3.select(nav)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .on("pointermove", pointermoved)
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0)
    .style("pointer-events", "none")
    .style("z-index", 0)
    .style("border", "1px solid red"); // for debugging

  function pointOnSquarePath(phase, r = radius, centerX = width / 2, centerY = height / 2) {
    const side = phase * 4;
    if (side < 1) {
      const t = side;
      return [centerX - r + 2 * r * t, centerY - r];
    } else if (side < 2) {
      const t = side - 1;
      return [centerX + r, centerY - r + 2 * r * t];
    } else if (side < 3) {
      const t = side - 2;
      return [centerX + r - 2 * r * t, centerY + r];
    } else {
      const t = side - 3;
      return [centerX - r, centerY + r - 2 * r * t];
    }
  }

  function forceFlowingSquarePath(speed = 0.005, strength = 0.1) {
    let nodes;
    function force(alpha) {
      nodes.forEach(node => {
        node.phase = (node.phase + speed) % 1;
        const [targetX, targetY] = pointOnSquarePath(node.phase);
        node.vx += (targetX - node.x) * strength * alpha;
        node.vy += (targetY - node.y) * strength * alpha;
      });
    }
    force.initialize = function(_nodes) {
      nodes = _nodes;
    };
    return force;
  }

  function pointermoved(event){
    const [x,y] = d3.pointer(event);
    repeller.fx = x;
    repeller.fy = y;
  }

  const g = svg.append("g");

  const simulation = d3.forceSimulation()
    .force("collide", d3.forceCollide().radius(13))
    .force("manyBody", d3.forceManyBody().strength(d => d.id === "mouse" ? -100 : 10))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(smooth ? 0.01 : 0.01))
    .force("squareFlow", forceFlowingSquarePath(0.0002, 0.3))
    .alpha(0.05)
    .alphaDecay(0);

  async function startNodeUpdates() {
    while (true) {
      const [x, y] = d3.pointRadial(2 * Math.PI * Math.random(), radius);
      nodes.push({
        id: Math.random(),
        phase: Math.random(),
        x, y
      });

      if (nodes.length > 20) {
        const idx = nodes.findIndex(n => n.id !== "mouse");
        if (idx !== -1) nodes.splice(idx, 1);
      }

      simulation.nodes(nodes);
      simulation.alpha(1).restart();

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  simulation.on("tick", () => {
    const circles = g.selectAll("circle:not(.exit)")
      .data(nodes, d => d.id)
      .join(
        enter => enter.append("circle")
          .attr("fill", d => d.id === "mouse" ? "transparent" : d3.interpolateSinebow(d.id))
          .attr("stroke", d => d.id === "mouse" ? "none" : "black")
          .attr("r", 1)
          .attr("transform", d => `translate(${d.x}, ${d.y})`)
          .style("pointer-events", d => d.id === "mouse" ? "none" : "auto")
          .transition()
          .duration(6000)
          .attr("r", 11)
          .selection(),
        update => update.attr("transform", d => `translate(${d.x}, ${d.y})`),
        exit => exit.classed("exit", true)
          .transition()
          .duration(2000)
          .attr("fill", "#eee")
          .attr("r", 2)
          .remove()
      );
  });

  startNodeUpdates();
});