import * as process from 'node:process';
import { ansi, createTerminal, shouldUseColors } from '@remix-run/terminal';
let colorDisabledByFlag = false;
export function configureColors(options) {
    colorDisabledByFlag = options.disabled;
}
export function bold(text, target = process.stdout) {
    return paint(text, ansi.bold, target);
}
export function lightGreen(text, target = process.stdout) {
    return paint(text, ansi.greenBright, target);
}
export function lightBlue(text, target = process.stdout) {
    return paint(text, ansi.blueBright, target);
}
export function boldLightBlue(text, target = process.stdout) {
    return isColorDisabled(target) ? text : `${ansi.bold}${ansi.blueBright}${text}${ansi.reset}`;
}
export function lightGray(text, target = process.stdout) {
    return paint(text, ansi.gray, target);
}
export function lightMagenta(text, target = process.stdout) {
    return paint(text, ansi.magentaBright, target);
}
export function lightRed(text, target = process.stdout) {
    return paint(text, ansi.redBright, target);
}
export function lightYellow(text, target = process.stdout) {
    return paint(text, ansi.yellowBright, target);
}
export function reset(target) {
    return isColorDisabled(target) ? '' : ansi.reset;
}
export function remixWordmark(target = process.stdout) {
    if (isColorDisabled(target)) {
        return 'REMIX';
    }
    return [
        paint('R', ansi.blueBright, target),
        paint('E', ansi.greenBright, target),
        paint('M', ansi.yellowBright, target),
        paint('I', ansi.magentaBright, target),
        paint('X', ansi.redBright, target),
    ].join('');
}
export function clearCurrentLine() {
    return `\r${ansi.clearLine}`;
}
export function restoreTerminalFormatting() {
    if (canUseAnsi(process.stdout)) {
        createTerminal({ stdout: process.stdout }).write(ansi.reset);
        return;
    }
    if (canUseAnsi(process.stderr)) {
        createTerminal({ stderr: process.stderr }).error(ansi.reset);
    }
}
function paint(text, colorCode, target) {
    return isColorDisabled(target) ? text : `${colorCode}${text}${ansi.reset}`;
}
function isColorDisabled(target) {
    return colorDisabledByFlag || !shouldUseColors({ stream: target });
}
export function canUseAnsi(target) {
    return process.env.TERM !== 'dumb' && target.isTTY === true;
}
