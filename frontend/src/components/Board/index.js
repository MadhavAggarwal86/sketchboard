import {useRef, useState, useEffect, useLayoutEffect, useContext} from "react";
import rough from "roughjs";
import boardContext from "../../store/board-context";
import { TOOL_ACTION_TYPES, TOOL_ITEMS } from "../../constants";
import toolBoxContext from "../../store/toolbox-context";
import { getTextLayout } from "../../utils/element";

function Board() {
  const canvasref = useRef();
  const {
    elements,
    editingTextId,
    activeToolItem,
    BoardMouseDownhandler,
    BoardMouseMovehandler,
    BoardMouseUpHandler,
    textAreaBlurHandler,
    cancelTextHandler,
    toolActionType,
  } = useContext(boardContext);
  const { toolboxState } = useContext(toolBoxContext);
  const [text, setText] = useState("");
  const textAreaRef = useRef(null);
  const cancelledTextId = useRef(null);
  const writingElement = toolActionType === TOOL_ACTION_TYPES.WRITING
    ? elements.find((element) => element.id === editingTextId)
    : null;
  const writingElementId = writingElement?.id;
  const writingSize = toolboxState[TOOL_ITEMS.TEXT]?.size ?? writingElement?.size ?? 16;
  const writingLayout = writingElement
    ? getTextLayout(
        text,
        writingSize,
        writingElement.layout?.maxWidth || Math.max(1, window.innerWidth - writingElement.x1 - 4)
      )
    : null;

  useEffect(() => {
    if (writingElementId !== undefined) {
      setText(writingElement.text || "");
      textAreaRef.current?.focus();
    }
  }, [writingElementId, toolActionType, writingElement?.text]);

  useEffect(() => {
    const canvas = canvasref.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

  }, []);

  useLayoutEffect(() => {
    const canvas = canvasref.current;
    const context = canvas.getContext("2d");
    const roughCanvas = rough.canvas(canvas); 

    elements.forEach((element) => {
      context.save();
      switch (element.type) {
        case TOOL_ITEMS.LINE:
        case TOOL_ITEMS.RECTANGLE:
        case TOOL_ITEMS.CIRCLE:
        case TOOL_ITEMS.ARROW:
          roughCanvas.draw(element.roughEle);
          break;
        case TOOL_ITEMS.BRUSH:
          context.fillStyle = element.stroke;
          context.fill(element.path);
          break;
        case TOOL_ITEMS.TEXT:
          context.textBaseline = "top";
          context.font = `${element.size || 16}px Caveat, cursive`;
          context.fillStyle = element.stroke;
          (element.layout?.lines || element.text.split("\n")).forEach((line, index) => {
            context.fillText(
              line,
              element.x1,
              element.y1 + index * (element.layout?.lineHeight || (element.size || 16) * 1.2)
            );
          });
          break;
        default:
          throw new Error("Type not recognized");
      }
      context.restore();
    });

    return () => {
      context.clearRect(0,0, canvas.width, canvas.height);
    };
  }, [elements]);

  const handleMouseDown = (event) => {
    if (writingElement) {
      textAreaBlurHandler(
        writingElementId,
        text,
        writingLayout,
        writingSize
      );
      return;
    }
    BoardMouseDownhandler(
      event,
      toolboxState,
      Math.max(1, window.innerWidth - event.clientX - 4)
    );
  }
  const handleCanvasClick = (event) => {
    if (writingElement) {
      textAreaBlurHandler(
        writingElementId,
        text,
        writingLayout,
        writingSize
      );
      return;
    }
    if (
      activeToolItem !== TOOL_ITEMS.TEXT
      || toolActionType !== TOOL_ACTION_TYPES.NONE
    ) {
      return;
    }
    BoardMouseDownhandler(
      event,
      toolboxState,
      Math.max(1, window.innerWidth - event.clientX - 4)
    );
    BoardMouseUpHandler();
  };
  const handleMouseMove = (event) => {
    if (
      toolActionType === TOOL_ACTION_TYPES.DRAWING
      || toolActionType === TOOL_ACTION_TYPES.ERASING
      || toolActionType === TOOL_ACTION_TYPES.MOVING_TEXT
    ) {
      BoardMouseMovehandler(event);
    }
  }

  const handleTextChange = (event) => {
    setText(event.target.value);
  };

  const handleTextBlur = (event) => {
    if (cancelledTextId.current === writingElementId) {
      cancelledTextId.current = null;
      return;
    }
    if (event.relatedTarget?.closest?.("[data-text-size-control], [data-text-color-control]")) return;
    textAreaBlurHandler(
      writingElementId,
      text,
      writingLayout,
      writingSize
    );
  };

  const handleTextKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelledTextId.current = writingElementId;
      cancelTextHandler(writingElementId);
    }
  };


  return (
    <>
      <canvas
        ref={canvasref}
        id="whiteboard-canvas"
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={BoardMouseUpHandler}
        onPointerCancel={BoardMouseUpHandler}
        onClick={handleCanvasClick}
      />
      {writingElement && (
        <textarea
          ref={textAreaRef}
          aria-label="Enter text"
          autoFocus
          value={text}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: writingElement.x1,
            top: writingElement.y1,
            width: writingLayout.maxWidth,
            minHeight: writingLayout.lineHeight,
            height: Math.max(writingLayout.lineHeight, writingLayout.height),
            boxSizing: "border-box",
            padding: 0,
            border: "none",
            outline: "none",
            resize: "none",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-all",
            lineHeight: `${writingLayout.lineHeight}px`,
            font: `${writingSize}px Caveat, cursive`,
            color: writingElement.stroke || "#000000",
            background: "transparent",
          }}
        />
      )}
    </>
  );
}

export default Board;
