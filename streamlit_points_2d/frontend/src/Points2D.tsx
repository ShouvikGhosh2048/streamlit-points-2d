import {
  Streamlit,
  withStreamlitConnection,
} from "streamlit-component-lib";
import React, { useEffect, useRef, useState } from "react";

// https://docs.rs/num/latest/num/fn.clamp.html
function clamp(x: number, a: number, b: number) {
  // https://stackoverflow.com/a/15313435
  if (a > b) {
    throw new Error(`Can't clamp with a = ${a}, b = ${b} : ${a} > ${b}`);
  }
  return Math.min(Math.max(a, x), b);
}

function ViewSelector({ view, setView }: {
  view: 'point' | 'image' | 'shape',
  setView: (view: 'point' | 'image' | 'shape') => void,
}) {
  return (<div style={{ "display": "flex" }}>
    <button
      onClick={() => { setView('point'); }}
      style={{
        border: "none",
        outline: "none",
        padding: "5px 10px",
        backgroundColor: view === 'point' ? "#cbd5e1" : "#f0f0f0",
      }}>Points</button>
    <button
      onClick={() => { setView('image'); }}
      style={{
        border: "none",
        outline: "none",
        padding: "5px 10px",
        backgroundColor: view === 'image' ? "#cbd5e1" : "#f0f0f0",
      }}>Image</button>
    <button
      onClick={() => { setView('shape'); }}
      style={{
        border: "none",
        outline: "none",
        padding: "5px 10px",
        backgroundColor: view === 'shape' ? "#cbd5e1" : "#f0f0f0",
      }}>Shape</button>
  </div>);
}

function PointEditor({ setView, points, setPoints }: {
  setView: (view: 'point' | 'image' | 'shape') => void,
  points: [number, number][],
  setPoints: React.Dispatch<React.SetStateAction<[number, number][]>>,
}) {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [drag, setDrag] = useState<null | { offsetFromCenter: [number, number] }>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (selectedPoint !== null) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete') {
          const newPoints = [...points.slice(0, selectedPoint), ...points.slice(selectedPoint + 1)];
          setPoints(newPoints);
          setSelectedPoint(null);
          setDrag(null);
          Streamlit.setComponentValue(newPoints);
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => { window.removeEventListener('keydown', onKeyDown); };
    }
  }, [selectedPoint, points, setPoints]);

  useEffect(() => {
    if (selectedPoint !== null && drag) {
      const onMouseMove = (e: MouseEvent) => {
        const svgBoundingBox = svgRef.current!.getBoundingClientRect();
        const point: [number, number] = [
          clamp(e.clientX - svgBoundingBox.left - drag.offsetFromCenter[0], 0, 400),
          clamp(e.clientY - svgBoundingBox.top - drag.offsetFromCenter[1], 0, 400)
        ];
        setPoints([...points.slice(0, selectedPoint), point, ...points.slice(selectedPoint + 1)]);
      };

      const onMouseUp = (e: MouseEvent) => {
        if (e.button !== 0) { // Left mouse button
          return;
        }
        const svgBoundingBox = svgRef.current!.getBoundingClientRect();
        const point: [number, number] = [
          clamp(e.clientX - svgBoundingBox.left - drag.offsetFromCenter[0], 0, 400),
          clamp(e.clientY - svgBoundingBox.top - drag.offsetFromCenter[1], 0, 400)
        ];
        const newPoints = [...points.slice(0, selectedPoint), point, ...points.slice(selectedPoint + 1)]
        setPoints(newPoints);
        setDrag(null);
        Streamlit.setComponentValue(newPoints);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [selectedPoint, drag, points, setPoints]);

  return (
    <div style={{ "display": "flex" }}>
      <div style={{ "width": "200px" }}>
        <ViewSelector view='point' setView={setView} />
        <button
          onClick={() => {
            setPoints([]);
            setSelectedPoint(null);
            setDrag(null);
            Streamlit.setComponentValue([]);
          }}
          style={{
            border: "none",
            outline: "none",
            padding: "5px 10px",
          }}>Reset</button>
      </div>
      <svg width="400" height="400" ref={svgRef}
        style={{ "border": "1px solid black" }}
        onMouseDown={(e) => {
          if (e.button === 0) { // Left mouse button
            const svgBoundingBox = svgRef.current!.getBoundingClientRect();
            const point: [number, number] = [e.clientX - svgBoundingBox.left, e.clientY - svgBoundingBox.top];
            setPoints([...points, point]);
            setSelectedPoint(points.length);
            setDrag({ offsetFromCenter: [0, 0] });
          }
        }}>
        {points.map((point, i) => (
          <circle
            cx={point[0]} cy={point[1]} r="7" fill={i === selectedPoint ? "#0369a1" : "black"}
            onMouseDown={(e) => {
              if (e.button === 0) {
                e.stopPropagation();
                setSelectedPoint(i);
                const svgBoundingBox = svgRef.current!.getBoundingClientRect();
                setDrag({ offsetFromCenter: [e.clientX - svgBoundingBox.left - point[0], e.clientY - svgBoundingBox.top - point[1]] });
              }
            }} key={i} />
        ))}
      </svg>
    </div>
  );
}

function ImageEditor({ setView, selectedSquares, setSelectedSquares, setPoints }: {
  setView: (view: 'point' | 'image' | 'shape') => void,
  selectedSquares: [number, number][],
  setSelectedSquares: React.Dispatch<React.SetStateAction<[number, number][]>>,
  setPoints: React.Dispatch<React.SetStateAction<[number, number][]>>,
}) {
  const IMAGE_DIMENSION = 30;
  const [drag, setDrag] = useState<null | { initialClientCoordinates: [number, number] }>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (drag) {
      let lastPosition = drag.initialClientCoordinates;

      const onMouseMove = (e: MouseEvent) => {
        const svgBoundingBox = svgRef.current!.getBoundingClientRect();

        let a = [
          (lastPosition[0] - svgBoundingBox.left) / 400 * IMAGE_DIMENSION,
          (lastPosition[1] - svgBoundingBox.top) / 400 * IMAGE_DIMENSION
        ];
        let b = [
          (e.clientX - svgBoundingBox.left) / 400 * IMAGE_DIMENSION,
          (e.clientY - svgBoundingBox.top) / 400 * IMAGE_DIMENSION
        ];
        if (a[0] > b[0]) {
          let c = a;
          a = b;
          b = c;
        }

        let newSquares: [number, number][] = [];
        if (Math.floor(a[0]) === Math.floor(b[0])) {
          // Vertical line
          let yMin = Math.floor(Math.min(a[1], b[1]));
          let yMax = Math.floor(Math.max(a[1], b[1]));
          for (let i = yMin; i <= yMax; i++) {
            newSquares.push([Math.floor(a[0]), i]);
          }
        } else {
          const m = (b[1] - a[1]) / (b[0] - a[0]);
          const c = a[1] - m * a[0];

          // From a to next.
          let y1 = a[1];
          let y2 = m * (Math.floor(a[0]) + 1) + c;
          let yMin, yMax;
          if (y1 < y2) {
            yMin = Math.floor(y1);
            yMax = Math.ceil(y2) - 1;
          } else {
            yMin = Math.floor(y2);
            yMax = Math.floor(y1);
          }
          for (let i = yMin; i <= yMax; i++) {
            newSquares.push([Math.floor(a[0]), i]);
          }

          // Middle.
          for (let x = Math.floor(a[0]) + 1; x < Math.floor(b[0]); x++) {
            const y1 = m * x + c;
            const y2 = m * (x + 1) + c;
            let yMin, yMax;
            if (y1 < y2) {
              yMin = Math.floor(y1);
              yMax = Math.ceil(y2) - 1;
            } else {
              yMin = Math.floor(y2);
              yMax = Math.floor(y1);
            }
            for (let i = yMin; i <= yMax; i++) {
              newSquares.push([x, i]);
            }
          }

          // before to b.
          yMin = Math.floor(Math.min(b[1], m * Math.floor(b[0]) + c));
          yMax = Math.floor(Math.max(b[1], m * Math.floor(b[0]) + c));
          for (let i = yMin; i <= yMax; i++) {
            newSquares.push([Math.floor(b[0]), i]);
          }
        }

        newSquares = newSquares.filter(s => 0 <= s[0] && s[0] < IMAGE_DIMENSION && 0 <= s[1] && s[1] < IMAGE_DIMENSION);

        setSelectedSquares(selectedSquares => [
          ...selectedSquares,
          ...newSquares.filter(newSquare => !selectedSquares.find(s => s[0] === newSquare[0] && s[1] === newSquare[1]))
        ]);

        lastPosition = [e.clientX, e.clientY];
      }

      const onMouseUp = (e: MouseEvent) => {
        if (e.button === 0) {
          setDrag(null);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [drag, setSelectedSquares]);

  const lines = [];
  for (let i = 1; i < IMAGE_DIMENSION; i++) {
    lines.push(<line x1="0" x2="400" y1={i / IMAGE_DIMENSION * 400} y2={i / IMAGE_DIMENSION * 400} key={i} stroke="gray" strokeDasharray="2" />);
  }
  for (let i = 1; i < IMAGE_DIMENSION; i++) {
    lines.push(<line x1={i / IMAGE_DIMENSION * 400} x2={i / IMAGE_DIMENSION * 400} y1="0" y2="400" key={i + IMAGE_DIMENSION} stroke="gray" strokeDasharray="2" />);
  }

  return (
    <div style={{ "display": "flex" }}>
      <div style={{ "width": "200px" }}>
        <ViewSelector view='image' setView={setView} />
        <div>
          <button
            onClick={() => {
              const newPoints: [number, number][] = selectedSquares.map(square => [
                (square[0] + 0.5) * 400 / IMAGE_DIMENSION,
                (square[1] + 0.5) * 400 / IMAGE_DIMENSION
              ]);
              setPoints(newPoints);
              setView('point');
              Streamlit.setComponentValue(newPoints);
            }}
            style={{
              border: "none",
              outline: "none",
              padding: "5px 10px",
            }}>Sample points</button>
          <button
            onClick={() => {
              setSelectedSquares([]);
              setDrag(null);
            }}
            style={{
              border: "none",
              outline: "none",
              padding: "5px 10px",
            }}>Reset</button>
        </div>
      </div>
      <svg width="400" height="400" ref={svgRef}
        style={{ "border": "1px solid black" }}
        onMouseDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          const svgBoundingBox = svgRef.current!.getBoundingClientRect();
          const square: [number, number] = [
            clamp(Math.floor((e.clientX - svgBoundingBox.left) / 400 * IMAGE_DIMENSION), 0, IMAGE_DIMENSION - 1),
            clamp(Math.floor((e.clientY - svgBoundingBox.top) / 400 * IMAGE_DIMENSION), 0, IMAGE_DIMENSION - 1)
          ];
          if (!selectedSquares.find(s => s[0] === square[0] && s[1] === square[1])) {
            setSelectedSquares([...selectedSquares, square]);
          }
          setDrag({ initialClientCoordinates: [e.clientX, e.clientY] });
        }}>
        {lines}
        {selectedSquares.map((square, i) => <rect key={i} x={square[0] * 400 / IMAGE_DIMENSION} y={square[1] * 400 / IMAGE_DIMENSION} width={400 / IMAGE_DIMENSION} height={400 / IMAGE_DIMENSION} />)}
      </svg>
    </div>
  )
}

function ShapeEditor({ setView, shapes, setShapes, setPoints }: {
  setView: (view: 'point' | 'image' | 'shape') => void,
  shapes: [[number, number], [number, number]][],
  setShapes: React.Dispatch<React.SetStateAction<[[number, number], [number, number]][]>>,
  setPoints: React.Dispatch<React.SetStateAction<[number, number][]>>,
}) {
  const [selectedShape, setSelectedShape] = useState<number | null>(null);
  const [drag, setDrag] = useState<
    null
    | { type: "newShape", initialPosition: [number, number], newShapeIndex: number }
    | { type: "shape", offsetFromAnchor0: [number, number] }
    | { type: "anchor", anchorIndex: number, offsetFromAnchorCenter: [number, number] }
  >(null);
  const [newRect, setNewRect] = useState<null | [[number, number], [number, number]]>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (selectedShape !== null) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete') {
          setDrag(null);
          setSelectedShape(null);
          setShapes(points => [...points.slice(0, selectedShape), ...points.slice(selectedShape + 1)]);
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => { window.removeEventListener('keydown', onKeyDown); };
    }
  }, [selectedShape, setShapes]);

  useEffect(() => {
    if (drag) {
      const onMouseMove = (e: MouseEvent) => {
        const svgBoundingBox = svgRef.current!.getBoundingClientRect();
        const point: [number, number] = [
          clamp(e.clientX - svgBoundingBox.left, 0, 400),
          clamp(e.clientY - svgBoundingBox.top, 0, 400)
        ];
        if (drag.type === "newShape") {
          setNewRect([drag.initialPosition, point]);
        } else if (drag.type === "shape" && selectedShape !== null) {
          setShapes(shapes => {
            const shape = shapes[selectedShape];
            const newShape: [[number, number], [number, number]] = [
              [point[0] - drag.offsetFromAnchor0[0], point[1] - drag.offsetFromAnchor0[1]],
              [
                point[0] - drag.offsetFromAnchor0[0] + shape[1][0] - shape[0][0],
                point[1] - drag.offsetFromAnchor0[1] + shape[1][1] - shape[0][1]
              ]
            ];
            return ([...shapes.slice(0, selectedShape), newShape, ...shapes.slice(selectedShape + 1)]);
          });
        } else if (drag.type === "anchor" && selectedShape !== null) {
          setShapes(shapes => {
            const newShape: [[number, number], [number, number]] = [...shapes[selectedShape]];
            newShape[drag.anchorIndex] = [point[0] - drag.offsetFromAnchorCenter[0], point[1] - drag.offsetFromAnchorCenter[1]];
            return ([...shapes.slice(0, selectedShape), newShape, ...shapes.slice(selectedShape + 1)]);
          });
        }
      };

      const onMouseUp = (e: MouseEvent) => {
        if (e.button !== 0) {
          return;
        }
        const svgBoundingBox = svgRef.current!.getBoundingClientRect();
        const point: [number, number] = [
          clamp(e.clientX - svgBoundingBox.left, 0, 400),
          clamp(e.clientY - svgBoundingBox.top, 0, 400)
        ];
        if (drag.type === "newShape") {
          setShapes(shapes => [...shapes, [drag.initialPosition, point]]);
          setSelectedShape(drag.newShapeIndex);
        }
        setDrag(null);
        setNewRect(null);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [selectedShape, drag, setShapes]);

  return (
    <div style={{ "display": "flex" }}>
      <div style={{ "width": "200px" }}>
        <ViewSelector view='shape' setView={setView} />
        <div>
          <button
            onClick={() => {
              let points = [];
              for (let i = 0; i < 10000; i++) {
                const point: [number, number] = [Math.random() * 400, Math.random() * 400];
                if (shapes.find(s => (
                  Math.min(s[0][0], s[1][0]) <= point[0]
                  && Math.max(s[0][0], s[1][0]) >= point[0]
                  && Math.min(s[0][1], s[1][1]) <= point[1]
                  && Math.max(s[0][1], s[1][1]) >= point[1]
                ))) {
                  points.push(point);
                  if (points.length === 100) {
                    break;
                  }
                }
              }
              setPoints(points);
              setView('point');
              Streamlit.setComponentValue(points);
            }}
            style={{
              border: "none",
              outline: "none",
              padding: "5px 10px",
            }}>Sample points</button>
          <button
            onClick={() => {
              setShapes([]);
              setSelectedShape(null);
              setDrag(null);
            }}
            style={{
              border: "none",
              outline: "none",
              padding: "5px 10px",
            }}>Reset</button>
        </div>
      </div>
      <svg width="400" height="400" ref={svgRef}
        style={{ "border": "1px solid black" }}
        onMouseDown={(e) => {
          if (e.button === 0) {
            const svgBoundingBox = svgRef.current!.getBoundingClientRect();
            const point: [number, number] = [e.clientX - svgBoundingBox.left, e.clientY - svgBoundingBox.top];
            setDrag({ type: "newShape", initialPosition: point, newShapeIndex: shapes.length });
            setSelectedShape(null);
          }
        }}>
        {shapes.map((shape, i) => (
          <rect x={Math.min(shape[0][0], shape[1][0])} y={Math.min(shape[0][1], shape[1][1])}
            width={Math.abs(shape[0][0] - shape[1][0])} height={Math.abs(shape[0][1] - shape[1][1])}
            fill="#404040" key={i}
            onMouseDown={(e) => {
              if (e.button === 0) {
                e.stopPropagation();
                setSelectedShape(i);
                const svgBoundingBox = svgRef.current!.getBoundingClientRect();
                setDrag({
                  type: "shape", offsetFromAnchor0: [
                    e.clientX - svgBoundingBox.left - shape[0][0],
                    e.clientY - svgBoundingBox.top - shape[0][1]
                  ]
                });
              }
            }} />
        ))}
        {selectedShape !== null && (
          <>
            <rect x={Math.min(shapes[selectedShape][0][0], shapes[selectedShape][1][0])}
              y={Math.min(shapes[selectedShape][0][1], shapes[selectedShape][1][1])}
              width={Math.abs(shapes[selectedShape][0][0] - shapes[selectedShape][1][0])}
              height={Math.abs(shapes[selectedShape][0][1] - shapes[selectedShape][1][1])}
              fill="#737373"
              onMouseDown={(e) => {
                if (e.button === 0) {
                  e.stopPropagation();
                  const svgBoundingBox = svgRef.current!.getBoundingClientRect();
                  setDrag({
                    type: "shape", offsetFromAnchor0: [
                      e.clientX - svgBoundingBox.left - shapes[selectedShape][0][0],
                      e.clientY - svgBoundingBox.top - shapes[selectedShape][0][1]
                    ]
                  });
                }
              }} />
            {[0, 1].map(i => (
              <circle cx={shapes[selectedShape][i][0]} cy={shapes[selectedShape][i][1]} r="7"
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    e.stopPropagation();
                    const svgBoundingBox = svgRef.current!.getBoundingClientRect();
                    const point = [e.clientX - svgBoundingBox.left, e.clientY - svgBoundingBox.top];
                    setDrag({
                      type: "anchor",
                      anchorIndex: i,
                      offsetFromAnchorCenter: [point[0] - shapes[selectedShape][i][0], point[1] - shapes[selectedShape][i][1]],
                    });
                  }
                }}
                fill="#b91c1c" key={i} />
            ))}
          </>
        )}
        {newRect && (
          <rect x={Math.min(newRect[0][0], newRect[1][0])} y={Math.min(newRect[0][1], newRect[1][1])}
            width={Math.abs(newRect[0][0] - newRect[1][0])} height={Math.abs(newRect[0][1] - newRect[1][1])}
            fill="rgba(0, 0, 255, 0.5)" />
        )}
      </svg>
    </div>
  );
}

function Points2D() {
  const [view, setView] = useState<'point' | 'image' | 'shape'>('point');
  const [points, setPoints] = useState<[number, number][]>([]);
  const [selectedSquares, setSelectedSquares] = useState<[number, number][]>([]);
  const [shapes, setShapes] = useState<[[number, number], [number, number]][]>([]);

  useEffect(() => {
    Streamlit.setFrameHeight(400);
  }); // TODO: Should this run every time we rerender?

  if (view === 'point') {
    return <PointEditor setView={setView} points={points} setPoints={setPoints} />;
  } else if (view === 'image') {
    return <ImageEditor setView={setView} selectedSquares={selectedSquares} setSelectedSquares={setSelectedSquares} setPoints={setPoints} />;
  } else {
    return <ShapeEditor setView={setView} shapes={shapes} setShapes={setShapes} setPoints={setPoints} />;
  }
}

// "withStreamlitConnection" is a wrapper function. It bootstraps the
// connection between your component and the Streamlit app, and handles
// passing arguments from Python -> Component.
//
// You don't need to edit withStreamlitConnection (but you're welcome to!).
export default withStreamlitConnection(Points2D);
