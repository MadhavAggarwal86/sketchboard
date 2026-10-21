import { useContext } from "react";
import { COLORS, FILL_TOOL_TYPES, SIZE_TOOL_TYPES, STROKE_TOOL_TYPES, TOOL_ITEMS } from "../../constants";
import classes from "./index.module.css";
import cx from "classnames";
import toolBoxContext from "../../store/toolbox-context";
import boardContext from "../../store/board-context";

const Toolbox = () => {
    const { activeToolItem } = useContext(boardContext);
    const { toolboxState, changeStroke, changeFill, changeSize } = useContext(toolBoxContext);

    const strokeColor = toolboxState[activeToolItem]?.stroke;
    const fillColor = toolboxState[activeToolItem]?.fill;
    const size = toolboxState[activeToolItem]?.size;

    
    return (
        <div className={classes.container}>
            {STROKE_TOOL_TYPES.includes(activeToolItem) && <div className={classes.selectOptionContainer}>
                <div className={classes.toolBoxLabel}>Stroke</div>
                <div className={classes.colorsContainer}>
                    <input
                        aria-label="Choose stroke color"
                        className={classes.colorPicker}
                        data-text-color-control={activeToolItem === TOOL_ITEMS.TEXT ? "true" : undefined}
                        type="color"
                        value={strokeColor || "#000000"}
                        onChange={(event) => changeStroke(activeToolItem, event.target.value)}
                    />
                    {Object.keys(COLORS).map((k) => {
                        return <div 
                            key={k}
                            className={cx(classes.colorBox, {[classes.activeColorBox]: strokeColor === COLORS[k]})} 
                            style={{backgroundColor: COLORS[k]}}
                            onClick={()=> changeStroke(activeToolItem, COLORS[k])}
                            ></div>
                    })}
                </div>
            </div>}
            {FILL_TOOL_TYPES.includes(activeToolItem) && <div className={classes.selectOptionContainer}>
                <div className={classes.toolBoxLabel}>Fill Color</div>
                <div className={classes.colorsContainer}>
                    <label className={classes.colorPickerControl}>
                        <span
                            aria-hidden="true"
                            className={cx(classes.colorPickerPreview, {
                                [classes.noFillColorBox]: fillColor == null,
                            })}
                            style={{ backgroundColor: fillColor || "transparent" }}
                        />
                        <input
                            aria-label="Choose fill color"
                            className={classes.colorPickerInput}
                            type="color"
                            value={fillColor || "#000000"}
                            onChange={(event) => changeFill(activeToolItem, event.target.value)}
                        />
                    </label>
                    <button
                        aria-label="No fill"
                        aria-pressed={fillColor == null}
                        className={cx(
                            classes.colorBox,
                            classes.noFillColorBox,
                            { [classes.activeColorBox]: fillColor == null }
                        )}
                        onClick={() => changeFill(activeToolItem, null)}
                        title="No fill"
                        type="button"
                    />
                    {Object.keys(COLORS).map((k) => {
                        return <div 
                            key={k}
                            className={cx(classes.colorBox, {[classes.activeColorBox]: fillColor === COLORS[k]})} 
                            style={{backgroundColor: COLORS[k]}}
                            onClick={()=> changeFill(activeToolItem, COLORS[k])}
                            ></div>
                    })}
                </div>
            </div>}
            {SIZE_TOOL_TYPES.includes(activeToolItem) && <div className={classes.selectOptionContainer}>
                <div className={classes.toolBoxLabel}>
                    {activeToolItem === TOOL_ITEMS.TEXT ? "Font Size" : "Brush Size"}
                </div>
                <div className={classes.colorsContainer}>
                    <input
                        type="range"
                        data-text-size-control={activeToolItem === TOOL_ITEMS.TEXT ? "true" : undefined}
                        min={1}
                        max={activeToolItem === TOOL_ITEMS.TEXT ? 48 : 10}
                        step={1}
                        value={size}
                        onChange={(event) => changeSize(activeToolItem, Number(event.target.value))}
                    ></input>
                </div>
            </div>}
        </div>
)}

export default Toolbox;