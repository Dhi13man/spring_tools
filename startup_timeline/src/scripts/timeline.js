document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('jsonFile');
    const timelineContainer = document.getElementById('timeline');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                renderTimeline(data);
                timelineContainer.style.display = 'block'; // Show timeline after data is loaded
            } catch (error) {
                alert('Error parsing JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    });
});

function renderTimeline(data) {
    const events = data.timeline.events;
    // sort events by startTime (ignoring parent relationships for simplicity)
    events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    const startTime = new Date(data.timeline.startTime).getTime();
    const endTime = Math.max(...events.map(e => new Date(e.endTime).getTime()));
    const totalDuration = endTime - startTime;
    
    const timelineContainer = document.getElementById('timeline');
    timelineContainer.innerHTML = '';
    
    // Add header
    const header = document.createElement('div');
    header.className = 'timeline-header';
    header.innerHTML = `
        <div>Total Startup Time: ${formatDurationAccurate(totalDuration)}</div>
        <div>Start: ${new Date(startTime).toISOString().split('T')[1].slice(0, -1)}</div>
        <div>Steps: ${events.length}</div>
    `;
    timelineContainer.appendChild(header);
    
    // Add timeline ruler with absolute timestamps
    const ruler = createTimelineRuler(startTime, endTime);
    timelineContainer.appendChild(ruler);
    
    // Fixed header height (use same in CSS)
    const headerHeight = 80;
    const containerWidth = timelineContainer.offsetWidth - 300; // reserve left margin for labels
    const containerLeft = 250;
    
    // Set container height based on number of events and a fixed vertical spacing of 25px
    timelineContainer.style.height = `${headerHeight + events.length * 25}px`;
    
    events.forEach((event, index) => {
        const eventStart = new Date(event.startTime).getTime();
        const eventEnd = new Date(event.endTime).getTime();
        const relativeStart = ((eventStart - startTime) / totalDuration) * containerWidth;
        const width = ((eventEnd - eventStart) / totalDuration) * containerWidth;
        
        const item = document.createElement('div');
        item.className = `timeline-item ${getEventType(event.startupStep.name)}`;
        item.style.left = `${containerLeft + relativeStart}px`;
        item.style.width = `${Math.max(2, width)}px`;
        item.style.top = `${headerHeight + (index * 25)}px`;
        
        const label = document.createElement('div');
        label.className = 'timeline-label';
        label.textContent = event.startupStep.name;
        
        const duration = document.createElement('div');
        duration.className = 'timeline-duration';
        duration.textContent = formatDurationAccurate(eventEnd - eventStart);
        
        item.appendChild(label);
        item.appendChild(duration);
        item.addEventListener('mouseover', (e) => showEnhancedTooltip(e, event, startTime));
        item.addEventListener('mouseout', hideTooltip);
        timelineContainer.appendChild(item);
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
    
    tooltip.innerHTML = `
        <strong>${event.startupStep.name}</strong><br>
        Duration: ${formatDurationAccurate(duration)}<br>
        Start: +${relativeStart.toFixed(3)}s<br>
        Time: ${start.toISOString().split('T')[1].slice(0, -1)}<br>
        ${event.children.length ? `Children: ${event.children.length}<br>` : ''}
        ${event.startupStep.tags?.length ? `Tags: ${event.startupStep.tags.join(', ')}<br>` : ''}
        ID: ${event.startupStep.id}
        ${event.startupStep.parentId ? `<br>Parent ID: ${event.startupStep.parentId}` : ''}
    `;
    
    // Position tooltip within viewport
    const rect = timelineContainer.getBoundingClientRect();
    const x = Math.min(e.pageX + 10, window.innerWidth - 300);
    const y = Math.min(e.pageY + 10, window.innerHeight - tooltip.offsetHeight - 10);
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    
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
