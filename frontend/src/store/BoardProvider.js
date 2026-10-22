import boardContext from "./board-context";
import { BOARD_ACTIONS, TOOL_ACTION_TYPES, TOOL_ITEMS } from "../constants";
import { useEffect, useReducer, useRef } from "react";
import {
    createRoughElement,
    getSvgPathFromStroke,
    isPointNearElement,
} from "../utils/element";
import getStroke from "perfect-freehand";

const getNextElementId = (elements) => (
    elements.reduce((nextId, element) => Math.max(nextId, element.id + 1), 0)
);

const boardReducer = (state, action) => {
    switch (action.type) {
        case BOARD_ACTIONS.CHANGE_TOOL: {
            if (state.toolActionType === TOOL_ACTION_TYPES.WRITING) return state;
            return {
                ...state,
                activeToolItem: action.payload.tool,
            };
        }
        case BOARD_ACTIONS.CHANGE_ACTION_TYPE:
            return {
                ...state,
                toolActionType: action.payload.actionType,
            };
        case BOARD_ACTIONS.DRAW_DOWN: {
                const {clientX, clientY, stroke, fill, size, maxWidth} = action.payload;
            if (state.activeToolItem === TOOL_ITEMS.TEXT) {
                const existingText = [...state.elements].reverse().find(
                    (element) => element.type === TOOL_ITEMS.TEXT
                        && isPointNearElement(element, clientX, clientY, 0)
                );
                if (existingText) {
                    return {
                        ...state,
                        toolActionType: TOOL_ACTION_TYPES.MOVING_TEXT,
                        textMove: {
                            id: existingText.id,
                            pointerX: clientX,
                            pointerY: clientY,
                            x1: existingText.x1,
                            y1: existingText.y1,
                            stroke,
                            size,
                            maxWidth,
                            moved: false,
                        },
                    };
                }
                const textElement = {
                    id: getNextElementId(state.elements),
                    type: TOOL_ITEMS.TEXT,
                    x1: clientX,
                    y1: clientY,
                    text: "",
                    stroke,
                    size,
                    layout: {
                        lines: [""],
                        width: 0,
                        height: (Number(size) || 16) * 1.2,
                        lineHeight: (Number(size) || 16) * 1.2,
                        maxWidth,
                    },
                };
                return {
                    ...state,
                    toolActionType: TOOL_ACTION_TYPES.WRITING,
                    elements: [...state.elements, textElement],
                    textEditing: {id: textElement.id, originalText: null},
                };
            }
            const newElement = createRoughElement(
                getNextElementId(state.elements),
                clientX, 
                clientY, 
                clientX, 
                clientY, 
                {type: state.activeToolItem, stroke, fill, size});
            const prevEle = state.elements;
            return {
                ...state,
                toolActionType: TOOL_ACTION_TYPES.DRAWING,
                elements: [...prevEle, newElement],
                hasChanged: true,
            };
        }    
        case BOARD_ACTIONS.DRAW_MOVE: {
            if (state.toolActionType !== TOOL_ACTION_TYPES.DRAWING || state.elements.length === 0) {
                return state;
            }
            const {clientX, clientY} = action.payload;
            const index = state.elements.length-1;
            const elements = [...state.elements];
            const currentElement = elements[index];
            const { type } = currentElement;
            switch (type) {
                case TOOL_ITEMS.LINE:
                case TOOL_ITEMS.RECTANGLE:
                case TOOL_ITEMS.ARROW:
                case TOOL_ITEMS.CIRCLE: {
                    const {id, x1, y1, stroke, fill, size} = currentElement;
                    const updatedElement = createRoughElement(id, x1, y1, clientX, clientY, {
                        type,
                        stroke,
                        fill,
                        size,
                    });
                    elements[index] = updatedElement;
                    return {
                        ...state,
                        elements,
                    }
                }
                case TOOL_ITEMS.BRUSH: {
                    const points = [
                        ...currentElement.points,
                        { x: clientX, y: clientY },
                    ];
                    elements[index] = {
                        ...currentElement,
                        points,
                        path: new Path2D(getSvgPathFromStroke(getStroke(points, {
                            size: currentElement.size,
                        }))),
                    };
                    return {
                        ...state,
                        elements,
                    };
                }
                case TOOL_ITEMS.TEXT:
                    return state;
            
                default:
                    throw new Error("Type not recognized");
            }
        }
        case BOARD_ACTIONS.ERASE: {
            if (state.toolActionType !== TOOL_ACTION_TYPES.ERASING) return state;
            const {clientX, clientY} = action.payload;
            const elements = state.elements.filter(
                (element) => !isPointNearElement(element, clientX, clientY)
            );
            if (elements.length === state.elements.length) return state;
            return {
                ...state,
                elements,
                hasChanged: true,
            };
        }
        case BOARD_ACTIONS.MOVE_TEXT: {
            if (state.toolActionType !== TOOL_ACTION_TYPES.MOVING_TEXT || !state.textMove) return state;
            const {clientX, clientY} = action.payload;
            const textMove = state.textMove;
            const x1 = textMove.x1 + clientX - textMove.pointerX;
            const y1 = textMove.y1 + clientY - textMove.pointerY;
            const moved = textMove.moved || x1 !== textMove.x1 || y1 !== textMove.y1;
            const elements = state.elements.map((element) => element.id === textMove.id
                ? {...element, x1, y1}
                : element);
            return {
                ...state,
                elements,
                textMove: {...textMove, moved},
                hasChanged: moved,
            };
        }
        case BOARD_ACTIONS.DRAW_UP: {
            if (state.toolActionType === TOOL_ACTION_TYPES.MOVING_TEXT) {
                const textMove = state.textMove;
                if (!textMove?.moved) {
                    const size = Number(textMove?.size) || 16;
                    const textElement = {
                        id: getNextElementId(state.elements),
                        type: TOOL_ITEMS.TEXT,
                        x1: textMove.pointerX,
                        y1: textMove.pointerY,
                        text: "",
                        stroke: textMove.stroke,
                        size,
                        layout: {
                            lines: [""],
                            width: 0,
                            height: size * 1.2,
                            lineHeight: size * 1.2,
                            maxWidth: textMove.maxWidth,
                        },
                    };
                    return {
                        ...state,
                        toolActionType: TOOL_ACTION_TYPES.WRITING,
                        elements: [...state.elements, textElement],
                        textEditing: {
                            id: textElement.id,
                            originalText: null,
                        },
                        textMove: null,
                    };
                }
            }
            if (
                state.toolActionType !== TOOL_ACTION_TYPES.DRAWING
                && state.toolActionType !== TOOL_ACTION_TYPES.ERASING
                && state.toolActionType !== TOOL_ACTION_TYPES.MOVING_TEXT
            ) {
                return state;
            }
            if (!state.hasChanged) {
                return {
                    ...state,
                    toolActionType: TOOL_ACTION_TYPES.NONE,
                };
            }
            const elementsCopy = [...state.elements];
            const newHistory = state.history.slice(0, state.index + 1);
            newHistory.push(elementsCopy);
            return {
                ...state,
                toolActionType: TOOL_ACTION_TYPES.NONE,
                hasChanged: false,
                textMove: null,
                history: newHistory,
                index: state.index + 1,
                saveVersion: state.saveVersion + 1,
                saveSnapshot: elementsCopy,
            };
        }
        case BOARD_ACTIONS.CHANGE_TEXT: {
            const {id, text, layout, size} = action.payload;
            const index = state.elements.findIndex((element) => element.id === id);
            if (index < 0 || state.elements[index].type !== TOOL_ITEMS.TEXT) {
                return {
                    ...state,
                    toolActionType: TOOL_ACTION_TYPES.NONE,
                    textEditing: null,
                };
            }
            if (!text.trim()) {
                const isNewText = state.textEditing?.originalText === null;
                if (!isNewText) {
                    const elements = state.elements.filter((element) => element.id !== id);
                    const history = state.history.slice(0, state.index + 1);
                    history.push(elements);
                    return {
                        ...state,
                        toolActionType: TOOL_ACTION_TYPES.NONE,
                        textEditing: null,
                        elements,
                        history,
                        index: state.index + 1,
                        saveVersion: state.saveVersion + 1,
                        saveSnapshot: elements,
                    };
                }
                return {
                    ...state,
                    toolActionType: TOOL_ACTION_TYPES.NONE,
                    textEditing: null,
                    elements: state.elements.filter((element) => element.id !== id),
                };
            }
            const elements = [...state.elements];
            if (elements[index].text === text && elements[index].size === size) {
                return {
                    ...state,
                    toolActionType: TOOL_ACTION_TYPES.NONE,
                    textEditing: null,
                };
            }
            elements[index] = {...elements[index], text, layout, size};
            const history = state.history.slice(0, state.index + 1);
            history.push(elements);
            return {
                ...state,
                toolActionType: TOOL_ACTION_TYPES.NONE,
                textEditing: null,
                elements,
                history,
                index: state.index + 1,
                hasChanged: false,
                saveVersion: state.saveVersion + 1,
                saveSnapshot: elements,
            };
        }
        case BOARD_ACTIONS.CANCEL_TEXT: {
            const id = state.textEditing?.id;
            const isNewText = state.textEditing?.originalText === null;
            return {
                ...state,
                toolActionType: TOOL_ACTION_TYPES.NONE,
                textEditing: null,
                elements: isNewText
                    ? state.elements.filter((element) => element.id !== id)
                    : state.elements,
            };
        }
        case BOARD_ACTIONS.UNDO:
            if (state.toolActionType !== TOOL_ACTION_TYPES.NONE) return state;
            if (state.index <= 0) return state;
            return {
                ...state,
                elements: state.history[state.index - 1],
                index: state.index - 1,
                toolActionType: TOOL_ACTION_TYPES.NONE,
                hasChanged: false,
                saveVersion: state.saveVersion + 1,
                saveSnapshot: state.history[state.index - 1],
            };
        case BOARD_ACTIONS.REDO:
            if (state.toolActionType !== TOOL_ACTION_TYPES.NONE) return state;
            if (state.index >= state.history.length - 1) return state;
            return {
                ...state,
                elements: state.history[state.index + 1],
                index: state.index + 1,
                toolActionType: TOOL_ACTION_TYPES.NONE,
                hasChanged: false,
                saveVersion: state.saveVersion + 1,
                saveSnapshot: state.history[state.index + 1],
            };
            
        default:
            return state;
        }
}
        
const createInitialBoardState = (elements = []) => ({
    activeToolItem: TOOL_ITEMS.BRUSH,
    toolActionType: TOOL_ACTION_TYPES.NONE,
    elements,
    history: [elements],
    index: 0,
    hasChanged: false,
    saveVersion: 0,
    saveSnapshot: elements,
    textEditing: null,
    textMove: null,
});
        
const BoardProvider = ({children, initialElements = [], onElementsChange}) => {
    const [boardState, dispatchBoardAction] = useReducer(
        boardReducer,
        initialElements,
        createInitialBoardState
    );
    const lastSavedVersionRef = useRef(boardState.saveVersion);

    useEffect(() => {
        if (boardState.saveVersion === lastSavedVersionRef.current) return undefined;
        const timeoutId = window.setTimeout(() => {
            lastSavedVersionRef.current = boardState.saveVersion;
            onElementsChange?.(boardState.saveSnapshot);
        }, 700);
        return () => window.clearTimeout(timeoutId);
    }, [boardState.saveVersion, boardState.saveSnapshot, onElementsChange]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
            if (event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;

            const key = event.key.toLowerCase();
            if (key === "z" && !event.shiftKey) {
                event.preventDefault();
                dispatchBoardAction({type: BOARD_ACTIONS.UNDO});
            } else if (key === "y") {
                event.preventDefault();
                dispatchBoardAction({type: BOARD_ACTIONS.REDO});
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);



    // const [activeToolItem, setActiveToolItem] = useState(TOOL_ITEMS.LINE);
    // const [elements, setElement] = useState([]);

    const ChangeToolhandler = (tool) => {
        dispatchBoardAction({
            type: BOARD_ACTIONS.CHANGE_TOOL,
            payload: {
                tool,
            }})
    }

    const BoardMouseDownhandler = (event, toolboxState, maxWidth) => {
        if (boardState.toolActionType === TOOL_ACTION_TYPES.WRITING) return;
        const {clientX, clientY} = event;
        if (boardState.activeToolItem === TOOL_ITEMS.ERASER) {
            dispatchBoardAction({
                type: BOARD_ACTIONS.CHANGE_ACTION_TYPE,
                payload: {actionType: TOOL_ACTION_TYPES.ERASING},
            });
            dispatchBoardAction({
                type: BOARD_ACTIONS.ERASE,
                payload: {clientX, clientY},
            });
            return;
        }
        dispatchBoardAction({
            type: BOARD_ACTIONS.DRAW_DOWN,
            payload: {
                clientX, 
                clientY,
                stroke: toolboxState[boardState.activeToolItem]?.stroke,
                fill: toolboxState[boardState.activeToolItem]?.fill,
                size: toolboxState[boardState.activeToolItem]?.size,
                maxWidth,
            }
        })
    }
    const BoardMouseMovehandler = (event) => {
        if (boardState.toolActionType === TOOL_ACTION_TYPES.WRITING) return;
        const {clientX, clientY} = event;
        if (boardState.toolActionType === TOOL_ACTION_TYPES.DRAWING) {
            dispatchBoardAction({
                type: BOARD_ACTIONS.DRAW_MOVE,
                payload: {clientX, clientY},
            });
        } else if (boardState.toolActionType === TOOL_ACTION_TYPES.MOVING_TEXT) {
            dispatchBoardAction({
                type: BOARD_ACTIONS.MOVE_TEXT,
                payload: {clientX, clientY},
            });
        } else if (boardState.toolActionType === TOOL_ACTION_TYPES.ERASING) {
            dispatchBoardAction({
                type: BOARD_ACTIONS.ERASE,
                payload: {clientX, clientY},
            });
        }
    }
    const BoardMouseUpHandler = () => {
        if (boardState.toolActionType === TOOL_ACTION_TYPES.WRITING) return;
        dispatchBoardAction({ type: BOARD_ACTIONS.DRAW_UP });
    }

    const textAreaBlurHandler = (id, text, layout, size) => {
        dispatchBoardAction({
            type: BOARD_ACTIONS.CHANGE_TEXT,
            payload: {id, text, layout, size},
        });
    };

    const cancelTextHandler = (id) => {
        dispatchBoardAction({
            type: BOARD_ACTIONS.CANCEL_TEXT,
            payload: {id},
        });
    };

    const undoHandler = () => {
        dispatchBoardAction({type: BOARD_ACTIONS.UNDO});
    };

    const redoHandler = () => {
        dispatchBoardAction({type: BOARD_ACTIONS.REDO});
    };

    const boardContextValue = {
        activeToolItem: boardState.activeToolItem,
        toolActionType: boardState.toolActionType,
        elements: boardState.elements,
        editingTextId: boardState.textEditing?.id,
        canUndo: boardState.index > 0,
        canRedo: boardState.index < boardState.history.length - 1,
        ChangeToolhandler,
        BoardMouseDownhandler,
        BoardMouseMovehandler,
        BoardMouseUpHandler,
        textAreaBlurHandler,
        cancelTextHandler,
        undo: undoHandler,
        redo: redoHandler,
    }


    return (
        <boardContext.Provider value={boardContextValue}>{children}</boardContext.Provider>
    )
}

export default BoardProvider;