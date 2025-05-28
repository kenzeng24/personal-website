const speed = 25;

function startCursorWiggle(el, callback) {
  const cursor = document.createElement("span");
  cursor.classList.add("blinking-cursor");
  cursor.textContent = "_";
  el.insertBefore(cursor, el.firstChild);

  let count = 0;
  const maxBlinks = 2;
  const blinkInterval = setInterval(() => {
    cursor.style.visibility = (cursor.style.visibility === "hidden") ? "visible" : "hidden";
    count++;
    if (count >= maxBlinks * 2) {
      clearInterval(blinkInterval);
      el.removeChild(cursor);
      if (callback) callback();
    }
  }, 500);
}

function typeText(el, lines, onComplete, isFirst = false) {
  if (el.dataset.typed) return;
  el.dataset.typed = true;
  el.classList.add("visible");

  let lineIndex = 0;

  function typeLine(lineText) {
    let i = 0;
    const span = document.createElement("span");
    span.classList.add("line", "cursor");
    el.appendChild(span);

    function typeChar() {
      if (i < lineText.length) {
        span.textContent += lineText.charAt(i);
        i++;
        setTimeout(typeChar, speed);
      } else {
        span.classList.remove("cursor");
        lineIndex++;
        if (lineIndex < lines.length) {
          setTimeout(() => typeLine(lines[lineIndex]), 400);
        } else {
          // Scroll into view
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (onComplete) setTimeout(() => onComplete(), 500);
        }
      }
    }

    typeChar();
  }

  if (isFirst) {
    startCursorWiggle(el, () => typeLine(lines[lineIndex]));
  } else {
    typeLine(lines[lineIndex]);
  }
}

const blocks = Array.from(document.querySelectorAll('.block'));

function startTypingBlocks(index = 0) {
  if (index >= blocks.length) {
    // Show CTA at the end
    const cta = document.getElementById("cta");
    cta.classList.add("visible");
    cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const block = blocks[index];
  const raw = block.getAttribute('data-lines');
  const json = raw.replace(/'/g, '"');
  const lines = JSON.parse(json);

  typeText(block, lines, () => startTypingBlocks(index + 1), index === 0);
}

document.addEventListener('DOMContentLoaded', () => {
  startTypingBlocks(0);
});