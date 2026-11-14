// Mirrors the gesture map the input agent implements (TASKS.md, "Agent 2: input").
const GESTURES: [string, string][] = [
  ['Zoom in', 'Pinch thumb, index and middle fingertips together and hold. It keeps zooming, faster the longer you hold; relax to stop.'],
  ['Zoom out', 'Spread thumb, index and middle apart with ring and pinky folded, and hold. Relax to stop.'],
  ['New example', 'One hand: twirl your index finger in a circle.'],
  ['Rotate', 'Pinch with one hand to grab the model, then draw circles with your other index finger. Circle at one height to spin around the vertical axis, toward and away from the camera for the horizontal axis, flat to the screen for the axis out of the screen.'],
  ['Next / previous model', 'A hard, fast open-hand swipe left or right flips through the models built in this lesson.'],
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
