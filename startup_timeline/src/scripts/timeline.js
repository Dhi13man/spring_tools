document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('jsonFile');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                renderTimeline(data);
            } catch (error) {
                console.error('Error parsing JSON file:', error);
            }
        };
        reader.readAsText(file);
    });
});

function computeChildrenCounts(events) {
    const counts = new Map();
    // Initialize counts
    events.forEach(e => counts.set(e.startupStep.id, 0));
    
    // Count direct children
    events.forEach(e => {
        if (e.startupStep.parentId !== undefined && counts.has(e.startupStep.parentId)) {
            counts.set(e.startupStep.parentId, counts.get(e.startupStep.parentId) + 1);
        }
    });
    
    // Compute total descendants (recursive)
    function getTotalDescendants(eventId) {
        let total = counts.get(eventId) || 0;
        events.filter(e => e.startupStep.parentId === eventId)
            .forEach(child => {
                total += getTotalDescendants(child.startupStep.id);
            });
        return total;
    }
    
    // Update events with their total descendant counts
    events.forEach(e => {
        e.totalDescendants = getTotalDescendants(e.startupStep.id);
        e.directChildren = counts.get(e.startupStep.id) || 0;
    });
}

function buildChildrenMap(events) {
    // Initialize an empty map for each event ID
    const map = new Map();
    events.forEach(e => map.set(e.startupStep.id, []));
    
    // Map children to their parents
    events.forEach(event => {
        if (event.startupStep.parentId !== undefined) {
            const parentChildren = map.get(event.startupStep.parentId);
            if (parentChildren) {
                parentChildren.push(event);
                // Sort children by start time
                parentChildren.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
            }
        }
    });
    return map;
}

function toggleChildren(rowId, isExpanded) {
    const childRows = document.querySelectorAll(`.child-of-${rowId}`);
    
    childRows.forEach(row => {
        // Set display style based on parent's expanded state
        row.style.display = isExpanded ? 'flex' : 'none';
        
        // Find if this row has a toggle button (meaning it's a parent)
        const toggleButton = row.querySelector('.name-label span');
        if (toggleButton) {
            // Update toggle button state
            toggleButton.textContent = isExpanded ? '▼' : '▶';
            
            // Get the ID of this child to recursively collapse its children
            const childId = row.className
                .split(' ')
                .find(cls => cls.startsWith('row-id-'))
                ?.replace('row-id-', '');
                
            if (childId) {
                // Recursively collapse children
                toggleChildren(childId, isExpanded);
            }
        }
    });
}

function transformEvents(events) {
    // First ensure all events have startupStep
    events.forEach((event, index) => {
        if (!event.startupStep) {
            event.startupStep = {
                id: index,
                name: `Event ${index}`
            };
        }
        // Ensure ID exists
        if (!event.startupStep.id) {
            event.startupStep.id = index;
        }
        // Ensure name exists
        if (!event.startupStep.name) {
            event.startupStep.name = `Event ${event.startupStep.id}`;
        }
    });

    // Build parent-child relationships
    const eventsById = new Map();
    events.forEach(event => {
        eventsById.set(event.startupStep.id, event);
    });

    // Now connect parents and children
    events.forEach(event => {
        if (event.startupStep.parentId !== undefined) {
            const parent = eventsById.get(event.startupStep.parentId);
            if (parent) {
                // Ensure parent has children array
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(event);
            }
        }
    });
}

function renderTimeline(data) {
    // Get references to required DOM elements
    const namesColumn = document.getElementById('timeline-names');
    const timelineColumn = document.getElementById('timeline-lines');
    const rulerHeader = document.getElementById('timeline-ruler-header');
    const metadataSection = document.getElementById('metadata-section');
    
    // Check if all required elements exist
    if (!namesColumn || !timelineColumn || !rulerHeader || !metadataSection) {
        console.error('Required DOM elements not found. Make sure the following elements exist:', {
            'timeline-names': !!namesColumn,
            'timeline-lines': !!timelineColumn,
            'timeline-ruler-header': !!rulerHeader,
            'metadata-section': !!metadataSection
        });
        return;
    }

    const events = data.timeline.events;
    
    // Transform events first
    transformEvents(events);
    
    // Add metadata rendering
    renderMetadata(data);
    
    events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    const startTime = new Date(data.timeline.startTime).getTime();
    const endTime = Math.max(...events.map(e => new Date(e.endTime).getTime()));
    const totalDuration = endTime - startTime;
    
    computeChildrenCounts(events);
    const childrenMap = buildChildrenMap(events);
    
    // Get root level events (events without parents or with missing parents)
    const rootEvents = events.filter(e => 
        !e.startupStep.parentId || 
        !events.find(p => p.startupStep.id === e.startupStep.parentId)
    );
    
    // Setup timeline ruler header
    rulerHeader.appendChild(createTimelineRuler(startTime, endTime));
    
    // Get available width of timeline area
    const containerWidth = timelineColumn.offsetWidth;
    
    // Render timeline recursively
    function renderEvent(event, depth = 0) {
        // Create name row
        const nameRow = document.createElement('div');
        nameRow.className = `timeline-row row-id-${event.startupStep.id}`;
        if (event.startupStep.parentId !== undefined) {
            nameRow.classList.add(`child-of-${event.startupStep.parentId}`);
        }
        
        const nameLabel = document.createElement('div');
        nameLabel.className = 'name-label';
        nameLabel.style.paddingLeft = `${depth * 20}px`;
        nameLabel.textContent = event.startupStep.name;
        
        // Add expand/collapse indicator if has children
        const children = childrenMap.get(event.startupStep.id) || [];
        if (children.length > 0) {
            const toggleIcon = document.createElement('span');
            toggleIcon.textContent = '▼';
            toggleIcon.style.cursor = 'pointer';
            toggleIcon.addEventListener('click', (e) => {
                const isExpanding = toggleIcon.textContent === '▶';
                toggleIcon.textContent = isExpanding ? '▼' : '▶';
                toggleChildren(event.startupStep.id, isExpanding);
                e.stopPropagation(); // Prevent event bubbling
            });
            nameLabel.prepend(toggleIcon, ' ');
        }
        
        nameRow.appendChild(nameLabel);
        namesColumn.appendChild(nameRow);
        
        // Create timeline row
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
        
        const duration = document.createElement('div');
        duration.className = 'timeline-duration';
        duration.textContent = formatDurationAccurate(eventEnd - eventStart);
        item.appendChild(duration);
        
        item.addEventListener('mouseover', (e) => showEnhancedTooltip(e, event, startTime));
        item.addEventListener('mouseout', hideTooltip);
        
        timelineRow.appendChild(item);
        timelineColumn.appendChild(timelineRow);
        
        // Recursively render children
        children.forEach(child => renderEvent(child, depth + 1));
    }
    
    // Start rendering from root events
    rootEvents.forEach(event => renderEvent(event));
}

function renderMetadata(data) {
    const startTime = new Date(data.timeline.startTime);
    // Calculate end time from the latest event end time
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
                <span class="metadata-value">${startTime.toLocaleTimeString()}</span>
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
    const markers = 20; // More granular markers
    
    for (let i = 0; i <= markers; i++) {
        const marker = document.createElement('div');
        marker.className = 'time-marker';
        marker.style.left = `${(i / markers) * 100}%`;
        
        const time = new Date(startTime + (duration * (i / markers)));
        marker.innerHTML = `<span>${time.toISOString().split('T')[1].slice(0, -1)}</span>`;
        
        ruler.appendChild(marker);
    }
    
    return ruler;
}

function getEventType(name) {
    if (name.includes('application')) return 'application';
    if (name.includes('context')) return 'context';
    if (name.includes('beans')) return 'beans';
    if (name.includes('web')) return 'web';
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
    
    const tagsContent = (event.startupStep.tags && event.startupStep.tags.length)
        ? event.startupStep.tags.map(tag => `${tag.key}: ${tag.value}`).join(', ')
        : 'No tags';
    
    tooltip.innerHTML = `
        <strong>Step: ${event.startupStep.name} (ID: ${event.startupStep.id})</strong><br>
        Duration: ${formatDurationAccurate(duration)}<br>
        Start: +${relativeStart.toFixed(3)}s<br>
        Time: ${start.toISOString().split('T')[1].slice(0, -1)}<br>
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

function formatDuration(duration) {
    // Convert PT0.123456S format to ms
    return duration.replace(/PT|S/g, '')
        .split('.')
        .reduce((acc, val, i) => {
            return i === 0 ? val * 1000 : acc + Number(val.padEnd(3, '0'));
        }, 0) + 'ms';
}

function formatDurationAccurate(ms) {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    if (ms < 60000) return `${(ms/1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
}

function hideTooltip() {
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(t => t.remove());
}
