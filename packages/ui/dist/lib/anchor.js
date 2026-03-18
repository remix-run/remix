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
function applyOffset(position, placement, offset) {
    if (offset === 0) {
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
    return { top, left };
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
function getFloatingDimensions(floating, relativeTo) {
    if (floating.offsetWidth > 0) {
        let relativeElement = relativeTo ? floating.querySelector(relativeTo) : null;
        if (relativeElement && !(relativeElement instanceof HTMLElement)) {
            relativeElement = null;
        }
        let relativeOffsetX = null;
        let relativeOffsetY = null;
        if (relativeElement instanceof HTMLElement) {
            let floatingRect = floating.getBoundingClientRect();
            let relativeRect = relativeElement.getBoundingClientRect();
            relativeOffsetX = relativeRect.left - floatingRect.left;
            relativeOffsetY = relativeRect.top - floatingRect.top;
        }
        return {
            width: floating.offsetWidth,
            height: floating.offsetHeight,
            relativeWidth: relativeElement instanceof HTMLElement ? relativeElement.offsetWidth : null,
            relativeHeight: relativeElement instanceof HTMLElement ? relativeElement.offsetHeight : null,
            relativeElement,
            relativeOffsetX,
            relativeOffsetY,
        };
    }
    let originalPosition = floating.style.position;
    let originalLeft = floating.style.left;
    let originalDisplay = floating.style.display;
    floating.style.position = 'absolute';
    floating.style.left = '-9999px';
    floating.style.display = 'block';
    let relativeElement = relativeTo ? floating.querySelector(relativeTo) : null;
    if (relativeElement && !(relativeElement instanceof HTMLElement)) {
        relativeElement = null;
    }
    let relativeOffsetX = null;
    let relativeOffsetY = null;
    if (relativeElement instanceof HTMLElement) {
        let floatingRect = floating.getBoundingClientRect();
        let relativeRect = relativeElement.getBoundingClientRect();
        relativeOffsetX = relativeRect.left - floatingRect.left;
        relativeOffsetY = relativeRect.top - floatingRect.top;
    }
    let dimensions = {
        width: floating.offsetWidth,
        height: floating.offsetHeight,
        relativeWidth: relativeElement instanceof HTMLElement ? relativeElement.offsetWidth : null,
        relativeHeight: relativeElement instanceof HTMLElement ? relativeElement.offsetHeight : null,
        relativeElement,
        relativeOffsetX,
        relativeOffsetY,
    };
    floating.style.position = originalPosition;
    floating.style.left = originalLeft;
    floating.style.display = originalDisplay;
    return dimensions;
}
function getViewportBounds(anchor) {
    if (getComputedStyle(anchor).position === 'fixed') {
        return {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight,
        };
    }
    return {
        left: window.scrollX,
        top: window.scrollY,
        right: window.scrollX + window.innerWidth,
        bottom: window.scrollY + window.innerHeight,
    };
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
function calculateFloatingBounds(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, relativeOffsetX, relativeOffsetY) {
    let position = calculatePosition(placement, anchorRect, placementWidth, placementHeight, inset);
    position = applyOffset(position, placement, offset);
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
function getPlacementScore(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, anchor, inset, offset, relativeOffsetX, relativeOffsetY) {
    let computedStyle = getComputedStyle(anchor);
    let viewport = computedStyle.position === 'fixed'
        ? getViewportBounds(anchor)
        : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    let bounds = calculateFloatingBounds(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, relativeOffsetX, relativeOffsetY);
    let constraints = {
        leftOk: bounds.left >= viewport.left,
        rightOk: bounds.right <= viewport.right,
        topOk: bounds.top >= viewport.top,
        bottomOk: bounds.bottom <= viewport.bottom,
    };
    let total = Object.values(constraints).filter(Boolean).length;
    return {
        total,
        perfect: total === 4,
    };
}
function getFlippedPlacement(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, anchor, inset, offset, relativeOffsetX, relativeOffsetY) {
    let computedStyle = getComputedStyle(anchor);
    let isAbsolutePositioned = computedStyle.position !== 'fixed';
    let hasScroll = window.scrollY > 0;
    if (placement.startsWith('top') && isAbsolutePositioned && hasScroll) {
        if (anchorRect.top - placementHeight < 0) {
            return placement;
        }
    }
    let original = getPlacementScore(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, anchor, inset, offset, relativeOffsetX, relativeOffsetY);
    if (original.perfect) {
        return placement;
    }
    let flippedPlacement = getOppositePlacement(placement);
    let flipped = getPlacementScore(flippedPlacement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, anchor, inset, offset, relativeOffsetX, relativeOffsetY);
    if (flipped.perfect || flipped.total > original.total) {
        return flippedPlacement;
    }
    return placement;
}
export function anchor(floating, anchorElement, options = {}) {
    if (!(floating instanceof HTMLElement)) {
        throw new TypeError('anchor() expected a floating HTMLElement');
    }
    if (!(anchorElement instanceof HTMLElement)) {
        throw new TypeError('anchor() expected an anchor HTMLElement');
    }
    let { placement = 'bottom', inset = false, relativeTo, offset = 0 } = options;
    let isFixed = floating.hasAttribute('popover') || getComputedStyle(anchorElement).position === 'fixed';
    let animationFrameId = 0;
    function updatePosition() {
        let anchorRect = anchorElement.getBoundingClientRect();
        let dimensions = getFloatingDimensions(floating, relativeTo);
        let placementWidth = relativeTo && dimensions.relativeWidth ? dimensions.relativeWidth : dimensions.width;
        let placementHeight = relativeTo && dimensions.relativeHeight ? dimensions.relativeHeight : dimensions.height;
        let finalPlacement = getFlippedPlacement(placement, anchorRect, placementWidth, placementHeight, dimensions.width, dimensions.height, anchorElement, inset, offset, dimensions.relativeOffsetX, dimensions.relativeOffsetY);
        let position = calculatePosition(finalPlacement, anchorRect, placementWidth, placementHeight, inset);
        if (!isFixed) {
            position.top += window.scrollY;
            position.left += window.scrollX;
        }
        position = applyOffset(position, finalPlacement, offset);
        if (dimensions.relativeElement &&
            dimensions.relativeOffsetX !== null &&
            dimensions.relativeOffsetY !== null) {
            position.left -= dimensions.relativeOffsetX;
            position.top -= dimensions.relativeOffsetY;
        }
        let minX = isFixed ? 0 : window.scrollX;
        let minY = isFixed ? 0 : window.scrollY;
        let maxX = isFixed ? window.innerWidth : window.scrollX + window.innerWidth;
        let maxY = isFixed ? window.innerHeight : window.scrollY + window.innerHeight;
        if (isHorizontalPlacement(finalPlacement)) {
            position.top = constrainToAxis(position.top, dimensions.height, minY, maxY);
            if (relativeTo) {
                let viewportLeft = isFixed ? 0 : window.scrollX;
                let viewportRight = isFixed ? window.innerWidth : window.scrollX + window.innerWidth;
                if (position.left < viewportLeft) {
                    position.left = viewportLeft;
                }
                else if (position.left + dimensions.width > viewportRight) {
                    position.left = viewportRight - dimensions.width;
                }
            }
        }
        else if (isVerticalPlacement(finalPlacement)) {
            position.left = constrainToAxis(position.left, dimensions.width, minX, maxX);
            if (!isFixed && window.scrollY > 0 && position.top - window.scrollY < 0) {
                position.top = window.scrollY;
            }
            if (relativeTo) {
                let viewportTop = isFixed ? 0 : window.scrollY;
                let viewportBottom = isFixed ? window.innerHeight : window.scrollY + window.innerHeight;
                if (position.top < viewportTop) {
                    position.top = viewportTop;
                }
                else if (position.top + dimensions.height > viewportBottom) {
                    position.top = viewportBottom - dimensions.height;
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
    }
    updatePosition();
    let lastRect = anchorElement.getBoundingClientRect();
    function pollForPositionChanges() {
        let currentRect = anchorElement.getBoundingClientRect();
        if (Math.abs(currentRect.top - lastRect.top) >= 1 ||
            Math.abs(currentRect.left - lastRect.left) >= 1 ||
            Math.abs(currentRect.right - lastRect.right) >= 1 ||
            Math.abs(currentRect.bottom - lastRect.bottom) >= 1) {
            lastRect = currentRect;
            updatePosition();
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