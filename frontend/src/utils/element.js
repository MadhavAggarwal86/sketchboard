import { ARROW_LENGTH, TOOL_ITEMS } from "../constants";
import rough from "roughjs/bin/rough";
import { getArrowRightHeads } from "./math";
import getStroke from "perfect-freehand";

const gen = rough.generator();


export const createRoughElement = (id, x1, y1, x2, y2, {type, stroke, fill, size}) => {

    const element = {
        id,
        type,
        x1,
        y1,
        x2,
        y2,
        stroke,
        fill,
        size,
    };
    let options = {
        seed: id + 1,
        fillStyle: "solid",
    }
    if(stroke) {
        options.stroke = stroke;
    }
    if(fill) {
        options.fill = fill;
    }
    if(size){
        options.strokeWidth = size;
    }

    switch (type) {
        case TOOL_ITEMS.BRUSH: {
            const brushElement = {
                id,
                points:[ {x: x1, y: y1} ],
                path: new Path2D(getSvgPathFromStroke(getStroke([ {x: x1, y: y1} ], {size}))),
                type,
                stroke,
                size,
            }
            return brushElement;
        }
        case TOOL_ITEMS.LINE:
        element.roughEle = gen.line(x1, y1, x2, y2, options);
            return element;
        case TOOL_ITEMS.RECTANGLE:
            element.roughEle = gen.rectangle(
                Math.min(x1, x2),
                Math.min(y1, y2),
                Math.abs(x2 - x1),
            Math.abs(y2 - y1),
            options
        );
        return element;
        case TOOL_ITEMS.CIRCLE:
            const cx = (x1+x2)/2;
            const cy = (y1+y2)/2;
            const width = Math.abs(x2-x1), height = Math.abs(y2-y1);
            element.roughEle = gen.ellipse(cx, cy, width, height, options);
            return element;
        case TOOL_ITEMS.ARROW:
            const { x3, y3, x4, y4 } = getArrowRightHeads(x1, x2, y1, y2, ARROW_LENGTH);
            const points = [ [x1,y1], [x2,y2], [x3,y3], [x2,y2], [x4,y4] ];
            element.roughEle = gen.linearPath(points, options);
            return element;
        default:
            throw new Error("Tool Type not recognized");

    }
}

export const serializeElements = (elements) => elements.map((element) => (
  Object.fromEntries(
    Object.entries(element).filter(([key]) => key !== "path" && key !== "roughEle")
  )
));

export const hydrateElements = (elements = []) => elements.map((element) => {
  if (element.type === TOOL_ITEMS.BRUSH) {
    const points = element.points || [];
    return {
      ...element,
      path: new Path2D(getSvgPathFromStroke(getStroke(points, {size: element.size}))),
    };
  }
  if ([TOOL_ITEMS.LINE, TOOL_ITEMS.RECTANGLE, TOOL_ITEMS.CIRCLE, TOOL_ITEMS.ARROW].includes(element.type)) {
    return createRoughElement(
      element.id,
      element.x1,
      element.y1,
      element.x2,
      element.y2,
      element
    );
  }
  return element;
});

export const getSvgPathFromStroke = (stroke) => {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
};

export const getTextLayout = (text, size, maxWidth = 320) => {
  const fontSize = Number(size) || 16;
  const lineHeight = fontSize * 1.2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${fontSize}px Caveat, cursive`;
  const lines = [];

  text.split("\n").forEach((paragraph) => {
    let line = "";
    for (const character of paragraph) {
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character.trim() ? character : "";
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  });

  const width = Math.max(0, ...lines.map((line) => context.measureText(line).width));
  return {
    lines,
    width,
    height: lines.length * lineHeight,
    lineHeight,
    maxWidth,
  };
};

const distanceToSegment = (x, y, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const closestX = x1 + projection * dx;
  const closestY = y1 + projection * dy;
  return Math.hypot(x - closestX, y - closestY);
};

export const isPointNearElement = (element, x, y, eraserRadius = 10) => {
  const tolerance = eraserRadius + (Number(element.size) || 1) / 2;

  switch (element.type) {
    case TOOL_ITEMS.LINE:
      return distanceToSegment(x, y, element.x1, element.y1, element.x2, element.y2) <= tolerance;
    case TOOL_ITEMS.ARROW: {
      const {x3, y3, x4, y4} = getArrowRightHeads(
        element.x1,
        element.x2,
        element.y1,
        element.y2,
        ARROW_LENGTH
      );
      return [
        [element.x1, element.y1, element.x2, element.y2],
        [element.x2, element.y2, x3, y3],
        [element.x2, element.y2, x4, y4],
      ].some(([x1, y1, x2, y2]) => distanceToSegment(x, y, x1, y1, x2, y2) <= tolerance);
    }
    case TOOL_ITEMS.RECTANGLE: {
      const left = Math.min(element.x1, element.x2);
      const right = Math.max(element.x1, element.x2);
      const top = Math.min(element.y1, element.y2);
      const bottom = Math.max(element.y1, element.y2);
      const inside = x >= left && x <= right && y >= top && y <= bottom;
      if (element.fill && inside) return true;
      return [
        [left, top, right, top],
        [right, top, right, bottom],
        [right, bottom, left, bottom],
        [left, bottom, left, top],
      ].some(([x1, y1, x2, y2]) => distanceToSegment(x, y, x1, y1, x2, y2) <= tolerance);
    }
    case TOOL_ITEMS.CIRCLE: {
      const radiusX = Math.abs(element.x2 - element.x1) / 2;
      const radiusY = Math.abs(element.y2 - element.y1) / 2;
      const centerX = (element.x1 + element.x2) / 2;
      const centerY = (element.y1 + element.y2) / 2;
      if (radiusX === 0 || radiusY === 0) {
        return distanceToSegment(x, y, element.x1, element.y1, element.x2, element.y2) <= tolerance;
      }
      const normalizedDistance = Math.hypot((x - centerX) / radiusX, (y - centerY) / radiusY);
      return (element.fill && normalizedDistance <= 1)
        || Math.abs(normalizedDistance - 1) * Math.min(radiusX, radiusY) <= tolerance;
    }
    case TOOL_ITEMS.BRUSH:
      return element.points.some((point, index, points) => {
        if (Math.hypot(x - point.x, y - point.y) <= tolerance) return true;
        if (index === 0) return false;
        const previous = points[index - 1];
        return distanceToSegment(x, y, previous.x, previous.y, point.x, point.y) <= tolerance;
      });
    case TOOL_ITEMS.TEXT: {
      const width = element.layout?.width ?? ((element.text?.length || 0) * (Number(element.size) || 16) * 0.6);
      const height = element.layout?.height ?? (Number(element.size) || 16);
      return x >= element.x1 - tolerance
        && x <= element.x1 + width + tolerance
        && y >= element.y1 - tolerance
        && y <= element.y1 + height + tolerance;
    }
    default:
      return false;
  }
};