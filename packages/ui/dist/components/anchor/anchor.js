const viewportPaddingPx = 16;
function isHorizontalPlacement(placement) {
    return placement.startsWith('left') || placement.startsWith('right');
}
function isVerticalPlacement(placement) {
    return placement.startsWith('top') || placement.startsWith('bottom');
}
function constrainToAxis(desiredPosition, elementSize, minBound, maxBound) {
    let elementEnd = desiredPosition + elementSize;
    if (elementEnd > maxBound) {
        desiredPosition -= elementEnd - maxBound;
    }
    if (desiredPosition < minBound) {
        desiredPosition = minBound;
    }
    return desiredPosition;
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function getConstrainedPositionRange(elementSize, minBound, maxBound) {
    return {
        min: minBound,
        max: Math.max(minBound, maxBound - elementSize),
    };
}
function getOffScreenStatus(anchorRect, axis) {
    if (axis === 'horizontal') {
        if (anchorRect.right <= 0)
            return 'before';
        if (anchorRect.left >= window.innerWidth)
            return 'after';
        return 'visible';
    }
    if (anchorRect.bottom <= 0)
        return 'before';
    if (anchorRect.top >= window.innerHeight)
        return 'after';
    return 'visible';
}
function applyOffset(position, placement, offset, offsetX = 0, offsetY = 0) {
    if (offset === 0 && offsetX === 0 && offsetY === 0) {
        return position;
    }
    let { top, left } = position;
    if (placement.startsWith('top')) {
        top -= offset;
    }
    else if (placement.startsWith('bottom')) {
        top += offset;
    }
    else if (placement.startsWith('left')) {
        left -= offset;
    }
    else if (placement.startsWith('right')) {
        left += offset;
    }
    left += offsetX;
    top += offsetY;
    return { top, left };
}
function resolveOffsetValue(offset, floating) {
    if (typeof offset === 'function') {
        return offset(floating);
    }
    return offset ?? 0;
}
function calculatePosition(placement, anchorRect, floatingWidth, floatingHeight, inset = false) {
    let top = anchorRect.bottom;
    let left = anchorRect.left + (anchorRect.width - floatingWidth) / 2;
    if (placement === 'bottom-start') {
        left = anchorRect.left;
    }
    else if (placement === 'bottom-end') {
        left = anchorRect.right - floatingWidth;
    }
    else if (placement === 'top') {
        top = anchorRect.top - floatingHeight;
    }
    else if (placement === 'top-start') {
        top = anchorRect.top - floatingHeight;
        left = anchorRect.left;
    }
    else if (placement === 'top-end') {
        top = anchorRect.top - floatingHeight;
        left = anchorRect.right - floatingWidth;
    }
    else if (placement === 'left') {
        top = anchorRect.top + (anchorRect.height - floatingHeight) / 2;
        left = anchorRect.left - floatingWidth;
    }
    else if (placement === 'left-start') {
        top = anchorRect.top;
        left = anchorRect.left - floatingWidth;
    }
    else if (placement === 'left-end') {
        top = anchorRect.bottom - floatingHeight;
        left = anchorRect.left - floatingWidth;
    }
    else if (placement === 'right') {
        top = anchorRect.top + (anchorRect.height - floatingHeight) / 2;
        left = anchorRect.right;
    }
    else if (placement === 'right-start') {
        top = anchorRect.top;
        left = anchorRect.right;
    }
    else if (placement === 'right-end') {
        top = anchorRect.bottom - floatingHeight;
        left = anchorRect.right;
    }
    if (inset) {
        if (placement.startsWith('bottom')) {
            top = anchorRect.bottom - floatingHeight;
        }
        else if (placement.startsWith('top')) {
            top = anchorRect.top;
        }
        else if (placement.startsWith('left')) {
            left = anchorRect.left;
        }
        else if (placement.startsWith('right')) {
            left = anchorRect.right - floatingWidth;
        }
    }
    return { top, left };
}
function isScrollableOverflow(value) {
    return value === 'auto' || value === 'scroll' || value === 'overlay';
}
function getRelativeScrollContainer(floating, relativeElement) {
    let current = relativeElement.parentElement;
    while (current && current !== floating) {
        let style = getComputedStyle(current);
        if (isScrollableOverflow(style.overflowX) || isScrollableOverflow(style.overflowY)) {
            return current;
        }
        current = current.parentElement;
    }
    return floating;
}
function readFloatingDimensions(floating, relativeTo) {
    let relativeElement = relativeTo ? floating.querySelector(relativeTo) : null;
    if (relativeElement && !(relativeElement instanceof HTMLElement)) {
        relativeElement = null;
    }
    let scrollContainer = relativeElement
        ? getRelativeScrollContainer(floating, relativeElement)
        : floating;
    let relativeOffsetX = null;
    let relativeOffsetY = null;
    let scrollContainerOffsetX = 0;
    let scrollContainerOffsetY = 0;
    if (relativeElement instanceof HTMLElement) {
        let floatingRect = floating.getBoundingClientRect();
        let scrollContainerRect = scrollContainer.getBoundingClientRect();
        let relativeRect = relativeElement.getBoundingClientRect();
        scrollContainerOffsetX = scrollContainerRect.left - floatingRect.left;
        scrollContainerOffsetY = scrollContainerRect.top - floatingRect.top;
        relativeOffsetX = relativeRect.left - scrollContainerRect.left + scrollContainer.scrollLeft;
        relativeOffsetY = relativeRect.top - scrollContainerRect.top + scrollContainer.scrollTop;
    }
    return {
        width: floating.offsetWidth,
        height: floating.offsetHeight,
        scrollContainer,
        scrollContainerOffsetX,
        scrollContainerOffsetY,
        scrollViewportWidth: scrollContainer.offsetWidth,
        scrollViewportHeight: scrollContainer.offsetHeight,
        scrollWidth: Math.max(scrollContainer.scrollWidth, scrollContainer.offsetWidth),
        scrollHeight: Math.max(scrollContainer.scrollHeight, scrollContainer.offsetHeight),
        relativeWidth: relativeElement instanceof HTMLElement ? relativeElement.offsetWidth : null,
        relativeHeight: relativeElement instanceof HTMLElement ? relativeElement.offsetHeight : null,
        relativeElement,
        relativeOffsetX,
        relativeOffsetY,
    };
}
function getFloatingDimensions(floating, relativeTo, { ignoreInlineMaxSize = false } = {}) {
    let originalPosition = floating.style.position;
    let originalLeft = floating.style.left;
    let originalDisplay = floating.style.display;
    let originalMaxWidth = floating.style.maxWidth;
    let originalMaxHeight = floating.style.maxHeight;
    if (ignoreInlineMaxSize) {
        floating.style.maxWidth = '';
        floating.style.maxHeight = '';
    }
    let needsTemporaryLayout = floating.offsetWidth === 0;
    if (needsTemporaryLayout) {
        floating.style.position = 'absolute';
        floating.style.left = '-9999px';
        floating.style.display = 'block';
    }
    let dimensions = readFloatingDimensions(floating, relativeTo);
    if (needsTemporaryLayout) {
        floating.style.position = originalPosition;
        floating.style.left = originalLeft;
        floating.style.display = originalDisplay;
    }
    if (ignoreInlineMaxSize) {
        floating.style.maxWidth = originalMaxWidth;
        floating.style.maxHeight = originalMaxHeight;
    }
    return dimensions;
}
function getClientViewportBounds(padding = 0) {
    return {
        left: padding,
        top: padding,
        right: window.innerWidth - padding,
        bottom: window.innerHeight - padding,
    };
}
function getDocumentViewportBounds(isFixed, padding = 0) {
    if (isFixed) {
        return getClientViewportBounds(padding);
    }
    return {
        left: window.scrollX + padding,
        top: window.scrollY + padding,
        right: window.scrollX + window.innerWidth - padding,
        bottom: window.scrollY + window.innerHeight - padding,
    };
}
function getOverflowAmount(bounds, viewport) {
    return (Math.max(viewport.left - bounds.left, 0) +
        Math.max(bounds.right - viewport.right, 0) +
        Math.max(viewport.top - bounds.top, 0) +
        Math.max(bounds.bottom - viewport.bottom, 0));
}
function hasRectChanged(currentRect, previousRect) {
    return (Math.abs(currentRect.top - previousRect.top) >= 1 ||
        Math.abs(currentRect.left - previousRect.left) >= 1 ||
        Math.abs(currentRect.right - previousRect.right) >= 1 ||
        Math.abs(currentRect.bottom - previousRect.bottom) >= 1);
}
function hasNullableNumberChanged(current, previous) {
    if (current === null || previous === null) {
        return current !== previous;
    }
    return Math.abs(current - previous) >= 1;
}
function hasFloatingDimensionsChanged(currentDimensions, previousDimensions) {
    return (Math.abs(currentDimensions.width - previousDimensions.width) >= 1 ||
        Math.abs(currentDimensions.height - previousDimensions.height) >= 1 ||
        Math.abs(currentDimensions.scrollViewportWidth - previousDimensions.scrollViewportWidth) >= 1 ||
        Math.abs(currentDimensions.scrollViewportHeight - previousDimensions.scrollViewportHeight) >=
            1 ||
        Math.abs(currentDimensions.scrollWidth - previousDimensions.scrollWidth) >= 1 ||
        Math.abs(currentDimensions.scrollHeight - previousDimensions.scrollHeight) >= 1 ||
        Math.abs(currentDimensions.scrollContainerOffsetX - previousDimensions.scrollContainerOffsetX) >= 1 ||
        Math.abs(currentDimensions.scrollContainerOffsetY - previousDimensions.scrollContainerOffsetY) >= 1 ||
        hasNullableNumberChanged(currentDimensions.relativeWidth, previousDimensions.relativeWidth) ||
        hasNullableNumberChanged(currentDimensions.relativeHeight, previousDimensions.relativeHeight) ||
        hasNullableNumberChanged(currentDimensions.relativeOffsetX, previousDimensions.relativeOffsetX) ||
        hasNullableNumberChanged(currentDimensions.relativeOffsetY, previousDimensions.relativeOffsetY));
}
function getOppositePlacement(placement) {
    let opposites = {
        top: 'bottom',
        'top-start': 'bottom-start',
        'top-end': 'bottom-end',
        bottom: 'top',
        'bottom-start': 'top-start',
        'bottom-end': 'top-end',
        left: 'right',
        'left-start': 'right-start',
        'left-end': 'right-end',
        right: 'left',
        'right-start': 'left-start',
        'right-end': 'left-end',
    };
    return opposites[placement];
}
function calculateFloatingBounds(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY) {
    let position = calculatePosition(placement, anchorRect, placementWidth, placementHeight, inset);
    position = applyOffset(position, placement, offset, offsetX, offsetY);
    if (relativeOffsetX !== null && relativeOffsetX !== undefined) {
        position.left -= relativeOffsetX;
    }
    if (relativeOffsetY !== null && relativeOffsetY !== undefined) {
        position.top -= relativeOffsetY;
    }
    return {
        top: position.top,
        left: position.left,
        right: position.left + collisionWidth,
        bottom: position.top + collisionHeight,
    };
}
function getPlacementScore(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY) {
    let viewport = getClientViewportBounds(viewportPaddingPx);
    let bounds = calculateFloatingBounds(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY);
    let constraints = {
        leftOk: bounds.left >= viewport.left,
        rightOk: bounds.right <= viewport.right,
        topOk: bounds.top >= viewport.top,
        bottomOk: bounds.bottom <= viewport.bottom,
    };
    let total = Object.values(constraints).filter(Boolean).length;
    return {
        overflow: getOverflowAmount(bounds, viewport),
        total,
        perfect: total === 4,
    };
}
function getFlippedPlacement(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, anchor, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY) {
    let computedStyle = getComputedStyle(anchor);
    let isAbsolutePositioned = computedStyle.position !== 'fixed';
    let hasScroll = window.scrollY > 0;
    if (placement.startsWith('top') && isAbsolutePositioned && hasScroll) {
        if (anchorRect.top - placementHeight < 0) {
            return placement;
        }
    }
    let original = getPlacementScore(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY);
    if (original.perfect) {
        return placement;
    }
    let flippedPlacement = getOppositePlacement(placement);
    let flipped = getPlacementScore(flippedPlacement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY);
    if (flipped.perfect ||
        flipped.total > original.total ||
        (flipped.total === original.total && flipped.overflow < original.overflow)) {
        return flippedPlacement;
    }
    return placement;
}
function getAvailableWidthForPlacement(placement, left, width, viewport) {
    if (placement.startsWith('left')) {
        return left + width - viewport.left;
    }
    if (placement.startsWith('right')) {
        return viewport.right - left;
    }
    return viewport.right - viewport.left;
}
function getAvailableHeightForPlacement(placement, top, height, viewport) {
    if (placement.startsWith('top')) {
        return top + height - viewport.top;
    }
    if (placement.startsWith('bottom')) {
        return viewport.bottom - top;
    }
    return viewport.bottom - viewport.top;
}
function calculateDocumentPosition(placement, anchorRect, placementWidth, placementHeight, inset, offset, offsetX, offsetY, isFixed, scrollContainerOffsetX = 0, scrollContainerOffsetY = 0, relativeOffsetX, relativeOffsetY) {
    let position = calculatePosition(placement, anchorRect, placementWidth, placementHeight, inset);
    if (!isFixed) {
        position.top += window.scrollY;
        position.left += window.scrollX;
    }
    position = applyOffset(position, placement, offset, offsetX, offsetY);
    position.left -= scrollContainerOffsetX;
    position.top -= scrollContainerOffsetY;
    if (relativeOffsetX !== null && relativeOffsetX !== undefined) {
        position.left -= relativeOffsetX;
    }
    if (relativeOffsetY !== null && relativeOffsetY !== undefined) {
        position.top -= relativeOffsetY;
    }
    return position;
}
function solveRelativeAlignmentAxis(options) {
    let maxScroll = Math.max(options.naturalSize - options.visibleSize, 0);
    let scroll = clamp(options.currentScroll, 0, maxScroll);
    if (maxScroll === 0) {
        return {
            position: clamp(options.desiredPosition, options.minPosition, options.maxPosition),
            scroll,
        };
    }
    let exactScrollMin = Math.max(0, options.minPosition - options.desiredPosition);
    let exactScrollMax = Math.min(maxScroll, options.maxPosition - options.desiredPosition);
    if (exactScrollMin <= exactScrollMax) {
        scroll = clamp(scroll, exactScrollMin, exactScrollMax);
    }
    else if (options.desiredPosition > options.maxPosition) {
        scroll = 0;
    }
    else if (options.desiredPosition + maxScroll < options.minPosition) {
        scroll = maxScroll;
    }
    return {
        position: clamp(options.desiredPosition + scroll, options.minPosition, options.maxPosition),
        scroll,
    };
}
export function anchor(floating, anchorElement, options = {}) {
    let lastAnchorRect;
    let lastFloatingDimensions;
    if (!(floating instanceof HTMLElement)) {
        throw new TypeError('anchor() expected a floating HTMLElement');
    }
    if (!(anchorElement instanceof HTMLElement)) {
        throw new TypeError('anchor() expected an anchor HTMLElement');
    }
    let { placement = 'bottom', inset = false, relativeTo, offset: rawOffset = 0, offsetX: rawOffsetX = 0, offsetY: rawOffsetY = 0, } = options;
    let isFixed = floating.hasAttribute('popover') || getComputedStyle(anchorElement).position === 'fixed';
    let animationFrameId = 0;
    function updatePosition(anchorRect = anchorElement.getBoundingClientRect(), naturalDimensions = getFloatingDimensions(floating, relativeTo, {
        ignoreInlineMaxSize: true,
    })) {
        let offset = resolveOffsetValue(rawOffset, floating);
        let offsetX = resolveOffsetValue(rawOffsetX, floating);
        let offsetY = resolveOffsetValue(rawOffsetY, floating);
        let viewport = getDocumentViewportBounds(isFixed, viewportPaddingPx);
        let placementWidth = relativeTo && naturalDimensions.relativeWidth
            ? naturalDimensions.relativeWidth
            : naturalDimensions.width;
        let placementHeight = relativeTo && naturalDimensions.relativeHeight
            ? naturalDimensions.relativeHeight
            : naturalDimensions.height;
        let finalPlacement = getFlippedPlacement(placement, anchorRect, placementWidth, placementHeight, naturalDimensions.width, naturalDimensions.height, anchorElement, inset, offset, offsetX, offsetY, naturalDimensions.relativeOffsetX, naturalDimensions.relativeOffsetY);
        floating.setAttribute('data-anchor-placement', finalPlacement);
        let position = calculateDocumentPosition(finalPlacement, anchorRect, placementWidth, placementHeight, inset, offset, offsetX, offsetY, isFixed, naturalDimensions.scrollContainerOffsetX, naturalDimensions.scrollContainerOffsetY, naturalDimensions.relativeOffsetX, naturalDimensions.relativeOffsetY);
        let availableWidth = Math.max(getAvailableWidthForPlacement(finalPlacement, position.left, naturalDimensions.width, viewport), 0);
        let availableHeight = Math.max(getAvailableHeightForPlacement(finalPlacement, position.top, naturalDimensions.height, viewport), 0);
        floating.style.maxWidth =
            availableWidth < naturalDimensions.width ? `${Math.floor(availableWidth)}px` : '';
        floating.style.maxHeight =
            availableHeight < naturalDimensions.height ? `${Math.floor(availableHeight)}px` : '';
        let dimensions = getFloatingDimensions(floating, relativeTo);
        placementWidth =
            relativeTo && dimensions.relativeWidth ? dimensions.relativeWidth : dimensions.width;
        placementHeight =
            relativeTo && dimensions.relativeHeight ? dimensions.relativeHeight : dimensions.height;
        position = calculateDocumentPosition(finalPlacement, anchorRect, placementWidth, placementHeight, inset, offset, offsetX, offsetY, isFixed, dimensions.scrollContainerOffsetX, dimensions.scrollContainerOffsetY, dimensions.relativeOffsetX, dimensions.relativeOffsetY);
        let minX = viewport.left;
        let minY = viewport.top;
        let maxX = viewport.right;
        let maxY = viewport.bottom;
        let xRange = getConstrainedPositionRange(dimensions.width, minX, maxX);
        let yRange = getConstrainedPositionRange(dimensions.height, minY, maxY);
        if (isHorizontalPlacement(finalPlacement)) {
            if (relativeTo && dimensions.relativeOffsetY !== null) {
                let solvedY = solveRelativeAlignmentAxis({
                    currentScroll: dimensions.scrollContainer.scrollTop,
                    desiredPosition: position.top,
                    naturalSize: dimensions.scrollHeight,
                    visibleSize: dimensions.scrollViewportHeight,
                    minPosition: yRange.min,
                    maxPosition: yRange.max,
                });
                dimensions.scrollContainer.scrollTop = solvedY.scroll;
                position.top = solvedY.position;
            }
            else {
                position.top = constrainToAxis(position.top, dimensions.height, minY, maxY);
            }
            if (relativeTo) {
                if (dimensions.relativeOffsetX !== null) {
                    let solvedX = solveRelativeAlignmentAxis({
                        currentScroll: dimensions.scrollContainer.scrollLeft,
                        desiredPosition: position.left,
                        naturalSize: dimensions.scrollWidth,
                        visibleSize: dimensions.scrollViewportWidth,
                        minPosition: xRange.min,
                        maxPosition: xRange.max,
                    });
                    dimensions.scrollContainer.scrollLeft = solvedX.scroll;
                    position.left = solvedX.position;
                }
                else {
                    position.left = clamp(position.left, xRange.min, xRange.max);
                }
            }
        }
        else if (isVerticalPlacement(finalPlacement)) {
            if (relativeTo && dimensions.relativeOffsetX !== null) {
                let solvedX = solveRelativeAlignmentAxis({
                    currentScroll: dimensions.scrollContainer.scrollLeft,
                    desiredPosition: position.left,
                    naturalSize: dimensions.scrollWidth,
                    visibleSize: dimensions.scrollViewportWidth,
                    minPosition: xRange.min,
                    maxPosition: xRange.max,
                });
                dimensions.scrollContainer.scrollLeft = solvedX.scroll;
                position.left = solvedX.position;
            }
            else {
                position.left = constrainToAxis(position.left, dimensions.width, minX, maxX);
            }
            if (!isFixed && window.scrollY > 0 && position.top < viewport.top) {
                position.top = viewport.top;
            }
            if (relativeTo) {
                if (dimensions.relativeOffsetY !== null) {
                    let solvedY = solveRelativeAlignmentAxis({
                        currentScroll: dimensions.scrollContainer.scrollTop,
                        desiredPosition: position.top,
                        naturalSize: dimensions.scrollHeight,
                        visibleSize: dimensions.scrollViewportHeight,
                        minPosition: yRange.min,
                        maxPosition: yRange.max,
                    });
                    dimensions.scrollContainer.scrollTop = solvedY.scroll;
                    position.top = solvedY.position;
                }
                else {
                    position.top = clamp(position.top, yRange.min, yRange.max);
                }
            }
        }
        if (isHorizontalPlacement(finalPlacement)) {
            let status = getOffScreenStatus(anchorRect, 'horizontal');
            if (status === 'before') {
                position.left = minX;
            }
            else if (status === 'after') {
                position.left = maxX - dimensions.width;
            }
        }
        else if (isVerticalPlacement(finalPlacement)) {
            let status = getOffScreenStatus(anchorRect, 'vertical');
            if (status === 'before') {
                position.top = minY;
            }
            else if (status === 'after') {
                position.top = maxY - dimensions.height;
            }
        }
        floating.style.position = isFixed ? 'fixed' : 'absolute';
        floating.style.inset = 'auto';
        floating.style.top = `${position.top}px`;
        floating.style.left = `${position.left}px`;
        lastAnchorRect = anchorRect;
        lastFloatingDimensions = dimensions;
    }
    updatePosition();
    function pollForPositionChanges() {
        let currentRect = anchorElement.getBoundingClientRect();
        let currentDimensions = getFloatingDimensions(floating, relativeTo);
        if (hasRectChanged(currentRect, lastAnchorRect) ||
            hasFloatingDimensionsChanged(currentDimensions, lastFloatingDimensions)) {
            updatePosition(currentRect, currentDimensions);
        }
        animationFrameId = requestAnimationFrame(pollForPositionChanges);
    }
    function handleScroll() {
        updatePosition();
    }
    function handleResize() {
        updatePosition();
    }
    animationFrameId = requestAnimationFrame(pollForPositionChanges);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
    };
}
//# sourceMappingURL=anchor.js.map