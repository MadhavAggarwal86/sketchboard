import boardContext from "./board-context";
import { BOARD_ACTIONS, TOOL_ACTION_TYPES, TOOL_ITEMS } from "../constants";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import {
    createElementId,
    createElementSeed,
    createRoughElement,
    getSvgPathFromStroke,
    hydrateElements,
    isPointNearElement,
    serializeElements,
} from "../utils/element";
import getStroke from "perfect-freehand";

const OUTBOX_FLUSH_DELAY_MS = 40;

const sameId = (first, second) => String(first) === String(second);

const findElement = (elements, id) => elements.find((element) => sameId(element.id, id));

const applyElementChange = (elements, id, element) => {
    const index = elements.findIndex((item) => sameId(item.id, id));
    if (!element) return index < 0 ? elements : elements.filter((_, itemIndex) => itemIndex !== index);
    if (index < 0) return [...elements, element];
    const nextElements = [...elements];
    nextElements[index] = element;
    return nextElements;
};

// Remember what an element looked like before the current gesture first touched it.
const trackBefore = (actionBefore, id, element) => (
    actionBefore.some((change) => sameId(change.id, id))
        ? actionBefore
        : [...actionBefore, {id, before: element ?? null}]
);

// History entries are lists of {id, before, after}, so undo/redo only touches the
// elements this user changed and leaves collaborators' work alone.
const commitChanges = (state, changes) => {
    const history = state.history.slice(0, state.index);
    history.push(changes);
    return {
        ...state,
        history,
        index: history.length,
        outbox: [
            ...state.outbox,
            ...changes.map(({id, after}) => ({id, element: after})),
        ],
    };
};

const createTextElement = (x1, y1, stroke, size, maxWidth) => {
    const fontSize = Number(size) || 16;
    return {
        id: createElementId(),
        type: TOOL_ITEMS.TEXT,
        x1,
        y1,
        text: "",
        stroke,
        size,
        layout: {
            lines: [""],
            width: 0,
            height: fontSize * 1.2,
            lineHeight: fontSize * 1.2,
            maxWidth,
        },
    };
};

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
                actionBefore: [],
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
                        actionBefore: [{id: existingText.id, before: existingText}],
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
                const textElement = createTextElement(clientX, clientY, stroke, size, maxWidth);
                return {
                    ...state,
                    toolActionType: TOOL_ACTION_TYPES.WRITING,
                    elements: [...state.elements, textElement],
                    textEditing: {id: textElement.id, originalText: null},
                };
            }
            const newElement = createRoughElement(
                createElementId(),
                clientX,
                clientY,
                clientX,
                clientY,
                {type: state.activeToolItem, stroke, fill, size, seed: createElementSeed()});
            return {
                ...state,
                toolActionType: TOOL_ACTION_TYPES.DRAWING,
                elements: [...state.elements, newElement],
                drawingId: newElement.id,
                actionBefore: [{id: newElement.id, before: null}],
                outbox: [...state.outbox, {id: newElement.id, element: newElement}],
                hasChanged: true,
            };
        }
        case BOARD_ACTIONS.DRAW_MOVE: {
            if (state.toolActionType !== TOOL_ACTION_TYPES.DRAWING) return state;
            const currentElement = findElement(state.elements, state.drawingId);
            // A collaborator may have erased the element while it was being drawn.
            if (!currentElement) return state;
            const {clientX, clientY} = action.payload;
            const { type } = currentElement;
            let updatedElement;
            switch (type) {
                case TOOL_ITEMS.LINE:
                case TOOL_ITEMS.RECTANGLE:
                case TOOL_ITEMS.ARROW:
                case TOOL_ITEMS.CIRCLE: {
                    const {id, x1, y1, stroke, fill, size, seed} = currentElement;
                    updatedElement = createRoughElement(id, x1, y1, clientX, clientY, {
                        type,
                        stroke,
                        fill,
                        size,
                        seed,
                    });
                    break;
                }
                case TOOL_ITEMS.BRUSH: {
                    const points = [
                        ...currentElement.points,
                        { x: clientX, y: clientY },
                    ];
                    updatedElement = {
                        ...currentElement,
                        points,
                        path: new Path2D(getSvgPathFromStroke(getStroke(points, {
                            size: currentElement.size,
                        }))),
                    };
                    break;
                }
                case TOOL_ITEMS.TEXT:
                    return state;

                default:
                    throw new Error("Type not recognized");
            }
            return {
                ...state,
                elements: applyElementChange(state.elements, updatedElement.id, updatedElement),
                outbox: [...state.outbox, {id: updatedElement.id, element: updatedElement}],
            };
        }
        case BOARD_ACTIONS.ERASE: {
            if (state.toolActionType !== TOOL_ACTION_TYPES.ERASING) return state;
            const {clientX, clientY} = action.payload;
            const erased = state.elements.filter(
                (element) => isPointNearElement(element, clientX, clientY)
            );
            if (!erased.length) return state;
            return {
                ...state,
                elements: state.elements.filter((element) => !erased.includes(element)),
                actionBefore: erased.reduce(
                    (actionBefore, element) => trackBefore(actionBefore, element.id, element),
                    state.actionBefore
                ),
                outbox: [
                    ...state.outbox,
                    ...erased.map((element) => ({id: element.id, element: null})),
                ],
                hasChanged: true,
            };
        }
        case BOARD_ACTIONS.MOVE_TEXT: {
            if (state.toolActionType !== TOOL_ACTION_TYPES.MOVING_TEXT || !state.textMove) return state;
            const {clientX, clientY} = action.payload;
            const textMove = state.textMove;
            const textElement = findElement(state.elements, textMove.id);
            if (!textElement) return state;
            const x1 = textMove.x1 + clientX - textMove.pointerX;
            const y1 = textMove.y1 + clientY - textMove.pointerY;
            const moved = textMove.moved || x1 !== textMove.x1 || y1 !== textMove.y1;
            const movedElement = {...textElement, x1, y1};
            return {
                ...state,
                elements: applyElementChange(state.elements, textMove.id, movedElement),
                outbox: moved
                    ? [...state.outbox, {id: textMove.id, element: movedElement}]
                    : state.outbox,
                textMove: {...textMove, moved},
                hasChanged: moved,
            };
        }
        case BOARD_ACTIONS.DRAW_UP: {
            if (state.toolActionType === TOOL_ACTION_TYPES.MOVING_TEXT) {
                const textMove = state.textMove;
                if (!textMove?.moved) {
                    const textElement = createTextElement(
                        textMove.pointerX,
                        textMove.pointerY,
                        textMove.stroke,
                        Number(textMove?.size) || 16,
                        textMove.maxWidth
                    );
                    return {
                        ...state,
                        toolActionType: TOOL_ACTION_TYPES.WRITING,
                        elements: [...state.elements, textElement],
                        textEditing: {
                            id: textElement.id,
                            originalText: null,
                        },
                        textMove: null,
                        actionBefore: [],
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
            const finishedState = {
                ...state,
                toolActionType: TOOL_ACTION_TYPES.NONE,
                hasChanged: false,
                textMove: null,
                drawingId: null,
                actionBefore: [],
            };
            const changes = state.hasChanged
                ? state.actionBefore
                    .map(({id, before}) => ({
                        id,
                        before,
                        after: findElement(state.elements, id) ?? null,
                    }))
                    .filter(({before, after}) => before !== after)
                : [];
            return changes.length ? commitChanges(finishedState, changes) : finishedState;
        }
        case BOARD_ACTIONS.CHANGE_TEXT: {
            const {id, text, layout, size} = action.payload;
            const currentElement = findElement(state.elements, id);
            const isNewText = state.textEditing?.originalText === null;
            const finishedState = {
                ...state,
                toolActionType: TOOL_ACTION_TYPES.NONE,
                textEditing: null,
            };
            if (!currentElement || currentElement.type !== TOOL_ITEMS.TEXT) {
                return finishedState;
            }
            if (!text.trim()) {
                const elements = state.elements.filter((element) => !sameId(element.id, id));
                if (isNewText) return {...finishedState, elements};
                return commitChanges(
                    {...finishedState, elements},
                    [{id, before: currentElement, after: null}]
                );
            }
            if (currentElement.text === text && currentElement.size === size) {
                return finishedState;
            }
            const updatedElement = {...currentElement, text, layout, size};
            return commitChanges(
                {
                    ...finishedState,
                    elements: applyElementChange(state.elements, id, updatedElement),
                    hasChanged: false,
                },
                [{id, before: isNewText ? null : currentElement, after: updatedElement}]
            );
        }
        case BOARD_ACTIONS.CANCEL_TEXT: {
            const id = state.textEditing?.id;
            const isNewText = state.textEditing?.originalText === null;
            return {
                ...state,
                toolActionType: TOOL_ACTION_TYPES.NONE,
                textEditing: null,
                elements: isNewText
                    ? state.elements.filter((element) => !sameId(element.id, id))
                    : state.elements,
            };
        }
        case BOARD_ACTIONS.UNDO:
        case BOARD_ACTIONS.REDO: {
            if (state.toolActionType !== TOOL_ACTION_TYPES.NONE) return state;
            const isUndo = action.type === BOARD_ACTIONS.UNDO;
            if (isUndo ? state.index <= 0 : state.index >= state.history.length) return state;
            const changes = state.history[isUndo ? state.index - 1 : state.index];
            const updates = changes.map(({id, before, after}) => ({
                id,
                element: isUndo ? before : after,
            }));
            return {
                ...state,
                elements: updates.reduce(
                    (elements, {id, element}) => applyElementChange(elements, id, element),
                    state.elements
                ),
                index: state.index + (isUndo ? -1 : 1),
                hasChanged: false,
                outbox: [...state.outbox, ...updates],
            };
        }
        case BOARD_ACTIONS.REMOTE_CHANGES: {
            const {upserts, deletes} = action.payload;
            let elements = state.elements;
            upserts.forEach((element) => {
                elements = applyElementChange(elements, element.id, element);
            });
            deletes.forEach((id) => {
                elements = applyElementChange(elements, id, null);
            });
            return {...state, elements};
        }
        case BOARD_ACTIONS.SYNC_ELEMENTS: {
            // Server snapshot on (re)join, with local changes that haven't been sent yet on top.
            let elements = state.outbox.reduce(
                (current, {id, element}) => applyElementChange(current, id, element),
                action.payload.elements
            );
            const editingElement = state.textEditing
                && findElement(state.elements, state.textEditing.id);
            if (editingElement && !findElement(elements, editingElement.id)) {
                elements = [...elements, editingElement];
            }
            return {...state, elements};
        }
        case BOARD_ACTIONS.CLEAR_OUTBOX:
            return {
                ...state,
                outbox: state.outbox.slice(action.payload.count),
            };

        default:
            return state;
        }
}

const createInitialBoardState = (elements = []) => ({
    activeToolItem: TOOL_ITEMS.BRUSH,
    toolActionType: TOOL_ACTION_TYPES.NONE,
    elements,
    history: [],
    index: 0,
    hasChanged: false,
    drawingId: null,
    actionBefore: [],
    outbox: [],
    textEditing: null,
    textMove: null,
});

// `realtime` connects the board to collaborators: send({upserts, deletes}) returns
// false while offline, and subscribe(listener) delivers "changes" and "sync" events.
const BoardProvider = ({children, initialElements = [], realtime}) => {
    const [boardState, dispatchBoardAction] = useReducer(
        boardReducer,
        initialElements,
        createInitialBoardState
    );
    const outboxRef = useRef(boardState.outbox);
    const flushTimerRef = useRef(null);

    useEffect(() => {
        outboxRef.current = boardState.outbox;
    });

    const flushOutbox = useCallback(() => {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
        const outbox = outboxRef.current;
        if (!outbox.length || !realtime) return;

        const latestChanges = new Map();
        outbox.forEach((change) => latestChanges.set(String(change.id), change));
        const upserts = [];
        const deletes = [];
        latestChanges.forEach(({id, element}) => {
            if (element) upserts.push(element);
            else deletes.push(id);
        });
        if (!realtime.send({upserts: serializeElements(upserts), deletes})) return;
        dispatchBoardAction({
            type: BOARD_ACTIONS.CLEAR_OUTBOX,
            payload: {count: outbox.length},
        });
    }, [realtime]);

    useEffect(() => {
        if (!boardState.outbox.length || flushTimerRef.current) return;
        flushTimerRef.current = window.setTimeout(flushOutbox, OUTBOX_FLUSH_DELAY_MS);
    }, [boardState.outbox, flushOutbox]);

    // Layout cleanups run before the parent's passive cleanup disconnects the socket.
    useLayoutEffect(() => () => flushOutbox(), [flushOutbox]);

    useEffect(() => {
        if (!realtime) return undefined;
        return realtime.subscribe((event) => {
            if (event.type === "changes") {
                dispatchBoardAction({
                    type: BOARD_ACTIONS.REMOTE_CHANGES,
                    payload: {
                        upserts: hydrateElements(event.upserts || []),
                        deletes: event.deletes || [],
                    },
                });
            } else if (event.type === "sync") {
                dispatchBoardAction({
                    type: BOARD_ACTIONS.SYNC_ELEMENTS,
                    payload: {elements: hydrateElements(event.elements || [])},
                });
                // Anything drawn while offline is still in the outbox; send it now.
                window.setTimeout(flushOutbox, 0);
            }
        });
    }, [realtime, flushOutbox]);

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
        canRedo: boardState.index < boardState.history.length,
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
