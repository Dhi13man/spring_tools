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

function renderTimeline(data) {
    const events = data.timeline.events;
    events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    const startTime = new Date(data.timeline.startTime).getTime();
    const endTime = Math.max(...events.map(e => new Date(e.endTime).getTime()));
    const totalDuration = endTime - startTime;
    
    // Clear and setup columns
    const namesColumn = document.getElementById('timeline-names');
    const timelineColumn = document.getElementById('timeline-lines');
    
    // Setup timeline ruler header
    const rulerHeader = document.getElementById('timeline-ruler-header');
    rulerHeader.innerHTML = '';
    rulerHeader.appendChild(createTimelineRuler(startTime, endTime));
    
    // Populate names column
    // Remove previous rows if any (note: header remains)
    namesColumn.querySelectorAll('.timeline-row').forEach(el => el.remove());
    
    // Populate timeline rows in timeline-lines column
    // Remove previously rendered rows (keeping header intact)
    timelineColumn.querySelectorAll('.timeline-row').forEach(el => el.remove());
    
    // Get available width of timeline area
    const containerWidth = timelineColumn.offsetWidth;
    
    events.forEach((event, index) => {
        // Create a row in names column
        const nameRow = document.createElement('div');
        nameRow.className = 'timeline-row';
        const nameLabel = document.createElement('div');
        nameLabel.className = 'name-label';
        nameLabel.textContent = event.startupStep.name;
        nameRow.appendChild(nameLabel);
        namesColumn.appendChild(nameRow);
        
        // Create a row in timeline column for the timeline event
        const timelineRow = document.createElement('div');
        timelineRow.className = 'timeline-row';
        
        const eventStart = new Date(event.startTime).getTime();
        const eventEnd = new Date(event.endTime).getTime();
        const relativeStart = ((eventStart - startTime) / totalDuration) * containerWidth;
        const width = ((eventEnd - eventStart) / totalDuration) * containerWidth;
        
        const item = document.createElement('div');
        item.className = `timeline-item ${getEventType(event.startupStep.name)}`;
        item.style.left = `${relativeStart}px`;
        item.style.width = `${Math.max(2, width)}px`;
        item.style.top = '0px'; // Within its row
        
        const duration = document.createElement('div');
        duration.className = 'timeline-duration';
        duration.textContent = formatDurationAccurate(eventEnd - eventStart);
        item.appendChild(duration);
        
        item.addEventListener('mouseover', (e) => showEnhancedTooltip(e, event, startTime));
        item.addEventListener('mouseout', hideTooltip);
        
        timelineRow.appendChild(item);
        timelineColumn.appendChild(timelineRow);
    });
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
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const duration = end.getTime() - start.getTime();
    const relativeStart = (start.getTime() - startTime) / 1000;
    
    // Prepare tags string
    const tagsContent = (event.startupStep.tags && event.startupStep.tags.length)
        ? event.startupStep.tags.map(tag => `${tag.key}: ${tag.value}`).join(', ')
        : 'No tags';
    
    tooltip.innerHTML = `
        <strong>Step: ${event.startupStep.name} (ID: ${event.startupStep.id})</strong><br>
        Duration: ${formatDurationAccurate(duration)}<br>
        Start: +${relativeStart.toFixed(3)}s<br>
        Time: ${start.toISOString().split('T')[1].slice(0, -1)}<br>
        Tags: ${tagsContent}
        ${event.startupStep.parentId ? `<br>Parent ID: ${event.startupStep.parentId}` : ''}
    `;
    
    // Define timelineContainer locally for computing position
    const timelineContainer = document.getElementById('timeline-wrapper');
    const rect = timelineContainer.getBoundingClientRect();
    const x = Math.min(e.pageX + 10, window.innerWidth - 300);
    const y = Math.min(e.pageY + 10, window.innerHeight - 100);
    
    // Set CSS custom properties instead of inline left/top styles
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
