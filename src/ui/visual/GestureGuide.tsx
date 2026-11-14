// Mirrors the gesture map the input agent implements (TASKS.md, "Agent 2: input").
const GESTURES: [string, string][] = [
  ['Zoom', 'One hand: open it wide or draw the fingers together.'],
  ['New example', 'One hand: twirl your index finger in a circle.'],
  ['Rotate', 'Pinch thumb and index on your left hand to hold the model, then turn your right index finger. The model turns about the same axis.'],
  ['Next / previous', 'A hard, fast open-hand swipe up or down changes section.'],
  ['Home', 'Hold both fists closed for a moment.'],
];

const OTHER: [string, string][] = [
  ['Voice', '"Show me methane", "graph x squared plus y squared", "another example".'],
  ['Keys', 'Arrows rotate, + and - zoom, T F S views, R resets.'],
  ['Mouse', 'Drag to orbit, scroll to zoom, right-drag to pan.'],
];

export function GestureGuide() {
  return (
    <aside className="card guide">
      <h3>Hand gestures</h3>
      <p className="muted">Start gestures in the input panel and allow the camera.</p>
      <dl>
        {GESTURES.map(([name, how]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{how}</dd>
          </div>
        ))}
      </dl>
      <h3>Also</h3>
      <dl>
        {OTHER.map(([name, how]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{how}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
