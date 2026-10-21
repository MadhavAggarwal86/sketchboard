import { useReducer } from "react";
import toolBoxContext from "./toolbox-context";

import { COLORS, TOOL_ITEMS } from "../constants";

function toolboxReducer (state, action) {
    switch (action.type) {
        case "CHANGE_STROKE": {
            const newstate = {...state};
            newstate[action.payload.tool].stroke = action.payload.stroke;
            return newstate;
        }
        case "CHANGE_FILL": {
            const newstate = {...state};
            newstate[action.payload.tool].fill = action.payload.fill;
            return newstate;
        }
        case "CHANGE_SIZE": {
            const newstate = {...state};
            newstate[action.payload.tool].size = action.payload.size;
            return newstate;
        }
        default:
            return state;
    }
}

const initialToolboxState = {
    [TOOL_ITEMS.BRUSH]: {
        stroke: COLORS.BLACK,
    },
    [TOOL_ITEMS.LINE]: {
        stroke: COLORS.BLACK,
        size: 1
    },
    [TOOL_ITEMS.RECTANGLE]: {
        stroke: COLORS.BLACK,
        fill: null,
        size: 1
    },
    [TOOL_ITEMS.CIRCLE]: {
        stroke: COLORS.BLACK,
        fill: null,
        size: 1
    },
    [TOOL_ITEMS.ARROW]: {
        stroke: COLORS.BLACK,
        size: 1
    },
    [TOOL_ITEMS.TEXT]: {
        stroke: COLORS.BLACK,
        size: 16
    },
};


const ToolBoxProvider = ({ children }) => {

    const [toolboxState, dispatchToolboxAction] = useReducer(toolboxReducer, initialToolboxState);

    const changeStrokeHandler = (tool, stroke) => {
        dispatchToolboxAction({
            type: "CHANGE_STROKE",
            payload: {
                tool,
                stroke,
            },
        });
    };
    const changeFillHandler = (tool, fill) => {
        dispatchToolboxAction({
            type: "CHANGE_FILL",
            payload: {
                tool,
                fill,
            },
        });
    };
    const changeSizeHandler = (tool, size) => {
        dispatchToolboxAction({
            type: "CHANGE_SIZE",
            payload: {
                tool,
                size,
            },
        });
    };

    const toolboxContextValue = {
        toolboxState,
        changeStroke: changeStrokeHandler,
        changeFill: changeFillHandler,
        changeSize: changeSizeHandler,
    };



    return ( <toolBoxContext.Provider value={toolboxContextValue}>{children}</toolBoxContext.Provider> );
};

export default ToolBoxProvider;