document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('jsonFile');
    const jsonEditor = document.getElementById('jsonEditor');

    // Handle file uploads
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                jsonEditor.value = JSON.stringify(data, null, 2);
                renderTimeline(data);
            } catch (error) {
                console.error('Error parsing JSON file:', error);
            }
        };
        reader.readAsText(file);
    });

    // Handle manual JSON editing with debounce
    let debounceTimer;
    jsonEditor.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            try {
                const jsonText = jsonEditor.value.trim();
                if (!jsonText) {
                    clearTimeline();
                    return;
                }
                const data = JSON.parse(jsonText);
                renderTimeline(data);
            } catch (error) {
                console.error('Invalid JSON:', error);
            }
        }, 500);
    });
});

function clearTimeline() {
    const elements = ['timeline-names', 'timeline-lines', 'timeline-ruler-header', 'metadata-section'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

// Ensure each event has a valid startupStep with id and name
function transformEvents(events) {
    events.forEach((event, index) => {
        if (!event.startupStep) {
            event.startupStep = { id: index, name: `Event ${index}` };
        }
        if (!event.startupStep.id) {
            event.startupStep.id = index;
        }
        if (!event.startupStep.name) {
            event.startupStep.name = `Event ${event.startupStep.id}`;
        }
    });
}

function computeChildrenCounts(events) {
    const counts = new Map();
    events.forEach(e => counts.set(e.startupStep.id, 0));

    // Count direct children
    events.forEach(e => {
        if (e.startupStep.parentId !== undefined && counts.has(e.startupStep.parentId)) {
            counts.set(e.startupStep.parentId, counts.get(e.startupStep.parentId) + 1);
        }
    });

    // Recursively count total descendants
    function getTotalDescendants(eventId) {
        let total = counts.get(eventId) || 0;
        events.filter(e => e.startupStep.parentId === eventId)
            .forEach(child => {
                total += getTotalDescendants(child.startupStep.id);
            });
        return total;
    }

    events.forEach(e => {
        e.directChildren = counts.get(e.startupStep.id) || 0;
        e.totalDescendants = getTotalDescendants(e.startupStep.id);
    });
}

function buildTimelineTree(events) {
    const eventMap = new Map();
    const rootEvents = [];

    // Create node for each event
    events.forEach(event => {
        eventMap.set(event.startupStep.id, { ...event, children: [], level: 0 });
    });

    // Build parent-child relationships and set depth level
    events.forEach(event => {
        const currentEvent = eventMap.get(event.startupStep.id);
        const parentId = event.startupStep.parentId;
        if (parentId !== undefined && parentId !== null) {
            const parentEvent = eventMap.get(parentId);
            if (parentEvent) {
                parentEvent.children.push(currentEvent);
                currentEvent.level = parentEvent.level + 1;
            } else {
                rootEvents.push(currentEvent);
            }
        } else {
            rootEvents.push(currentEvent);
        }
    });

    // Sort events by start time
    const sortByStartTime = (a, b) => new Date(a.startTime) - new Date(b.startTime);
    const sortChildrenRecursive = (event) => {
        if (event.children.length) {
            event.children.sort(sortByStartTime);
            event.children.forEach(sortChildrenRecursive);
        }
    };

    rootEvents.sort(sortByStartTime);
    rootEvents.forEach(sortChildrenRecursive);

    return rootEvents;
}

function calculateEventPosition(event, totalWidth, startTime, duration) {
    const eventStart = new Date(event.startTime) - startTime;
    const eventDuration = new Date(event.endTime) - new Date(event.startTime);
    const left = (eventStart / duration) * totalWidth;
    const width = Math.max((eventDuration / duration) * totalWidth, 2); // Minimum width
    return { left, width };
}

function toggleChildren(rowId, isExpanded) {
    const childRows = document.querySelectorAll(`.child-of-${rowId}`);
    childRows.forEach(row => {
        row.classList.toggle('collapsed', !isExpanded);
        const toggleButton = row.querySelector('.name-label span');
        if (toggleButton) {
            toggleButton.textContent = isExpanded ? '▼' : '▶';
            const childId = row.className.split(' ')
                .find(cls => cls.startsWith('row-id-'))
                ?.replace('row-id-', '');
            if (childId) {
                toggleChildren(childId, isExpanded);
            }
        }
    });
}

function renderTimeline(data) {
    const namesColumn = document.getElementById('timeline-names');
    const timelineColumn = document.getElementById('timeline-lines');
    const rulerHeader = document.getElementById('timeline-ruler-header');
    const metadataSection = document.getElementById('metadata-section');

    if (!namesColumn || !timelineColumn || !rulerHeader || !metadataSection) {
        console.error('Missing required DOM elements.', {
            'timeline-names': !!namesColumn,
            'timeline-lines': !!timelineColumn,
            'timeline-ruler-header': !!rulerHeader,
            'metadata-section': !!metadataSection
        });
        return;
    }

    const events = data.timeline.events;
    transformEvents(events);
    renderMetadata(data);

    events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const startTime = new Date(data.timeline.startTime).getTime();
    const endTime = Math.max(...events.map(e => new Date(e.endTime).getTime()));
    const totalDuration = endTime - startTime;

    computeChildrenCounts(events);
    const rootEvents = buildTimelineTree(events);
    rulerHeader.appendChild(createTimelineRuler(startTime, endTime));
    const containerWidth = timelineColumn.offsetWidth;

    // Recursively render each event and its children
    function renderEvent(event, depth = 0) {
        // Create name row with indentation and collapse toggle if needed
        const nameRow = document.createElement('div');
        nameRow.className = `timeline-row row-id-${event.startupStep.id}`;
        if (event.startupStep.parentId !== undefined) {
            nameRow.classList.add(`child-of-${event.startupStep.parentId}`);
        }
        const nameLabel = document.createElement('div');
        nameLabel.className = 'name-label';
        nameLabel.style.paddingLeft = `${depth}em`;
        nameLabel.textContent = event.startupStep.name;

        if ((event.children || []).length > 0) {
            const toggleIcon = document.createElement('span');
            toggleIcon.textContent = '▼';
            toggleIcon.style.cursor = 'pointer';
            toggleIcon.addEventListener('click', (e) => {
                const isExpanding = toggleIcon.textContent === '▶';
                toggleIcon.textContent = isExpanding ? '▼' : '▶';
                toggleChildren(event.startupStep.id, isExpanding);
                e.stopPropagation();
            });
            nameLabel.prepend(toggleIcon, ' ');
        }

        nameRow.appendChild(nameLabel);
        namesColumn.appendChild(nameRow);

        // Create timeline row for the event
        const timelineRow = document.createElement('div');
        timelineRow.className = 'timeline-row';
        if (event.startupStep.parentId !== undefined) {
            timelineRow.classList.add(`child-of-${event.startupStep.parentId}`);
        }

        const eventStart = new Date(event.startTime).getTime();
        const eventEnd = new Date(event.endTime).getTime();
        const relativeStart = ((eventStart - startTime) / totalDuration) * containerWidth;
        const width = ((eventEnd - eventStart) / totalDuration) * containerWidth;
        const item = document.createElement('div');
        item.className = `timeline-item ${getEventType(event.startupStep.name)}`;
        item.style.left = `${relativeStart}px`;
        item.style.width = `${Math.max(2, width)}px`;

        const durationDiv = document.createElement('div');
        durationDiv.className = 'timeline-duration';
        durationDiv.textContent = formatDurationAccurate(eventEnd - eventStart);
        item.appendChild(durationDiv);

        item.addEventListener('mouseover', (e) => showEnhancedTooltip(e, event, startTime));
        item.addEventListener('mouseout', hideTooltip);

        timelineRow.appendChild(item);
        timelineColumn.appendChild(timelineRow);

        // Render children recursively
        (event.children || []).forEach(child => renderEvent(child, depth + 1));
    }

    rootEvents.forEach(event => renderEvent(event));
}

function renderMetadata(data) {
    const startTime = new Date(data.timeline.startTime);
    const endTime = new Date(Math.max(...data.timeline.events.map(e => new Date(e.endTime).getTime())));
    const totalDuration = endTime - startTime;
    const metadataSection = document.getElementById('metadata-section');

    metadataSection.innerHTML = `
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="metadata-label">Total Startup Time:</span>
          <span class="metadata-value">${formatDurationAccurate(totalDuration)}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Start Time:</span>
          <span class="metadata-value">${startTime.toISOString()}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Total Steps:</span>
          <span class="metadata-value">${data.timeline.events.length}</span>
        </div>
      </div>
    `;
}

function createTimelineRuler(startTime, endTime) {
    const ruler = document.createElement('div');
    ruler.className = 'timeline-ruler';
    const duration = endTime - startTime;
    const markers = 15; // More granular markers

    for (let i = 0; i <= markers; i++) {
        const marker = document.createElement('div');
        marker.className = 'time-marker';
        marker.style.left = `${(i / markers) * 100}%`;
        const time = new Date(startTime + duration * (i / markers));
        marker.innerHTML = `<span>${time.toISOString().split('T')[1]}</span>`;
        ruler.appendChild(marker);
    }
    return ruler;
}

function getEventType(name) {
    if (name.includes('spring.boot.application')) return 'application';
    if (name.includes('spring.beans')) return 'beans';
    if (name.includes('spring.context')) return 'context';
    if (name.includes('spring.boot.web')) return 'web';
    return 'startup';
}

function showEnhancedTooltip(e, event, startTime) {
    const timelineContainer = document.getElementById('timeline-wrapper');
    if (!timelineContainer) {
        console.error('Timeline wrapper element not found');
        return;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';

    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const duration = end.getTime() - start.getTime();
    const relativeStart = (start.getTime() - startTime) / 1000;

    const tagsContent = event.startupStep.tags && event.startupStep.tags.length
        ? event.startupStep.tags.map(tag => `${tag.key}: ${tag.value}`).join(', ')
        : 'No tags';

    tooltip.innerHTML = `
      <strong>Step: ${event.startupStep.name} (ID: ${event.startupStep.id})</strong><br>
      Duration: ${formatDurationAccurate(duration)}<br>
      Start: +${relativeStart.toFixed(3)}s<br>
      Time: ${start.toISOString()}<br>
      Tags: ${tagsContent}
      ${event.startupStep.parentId !== undefined ? `<br>Parent ID: ${event.startupStep.parentId}` : ''}
      <br>Direct Children: ${event.directChildren}
      <br>Total Descendants: ${event.totalDescendants}
    `;

    const rect = timelineContainer.getBoundingClientRect();
    const x = Math.min(e.pageX + 10, window.innerWidth - 300);
    const y = Math.min(e.pageY + 10, window.innerHeight - 100);
    tooltip.style.setProperty('--tooltip-left', `${x}px`);
    tooltip.style.setProperty('--tooltip-top', `${y}px`);

    document.body.appendChild(tooltip);
}

function hideTooltip() {
    document.querySelectorAll('.tooltip').forEach(t => t.remove());
}

function formatDurationAccurate(ms) {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
}
