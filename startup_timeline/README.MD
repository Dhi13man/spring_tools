# Spring Boot Startup Timeline Visualizer

A web-based tool for visualizing and analyzing Spring Boot application startup sequences to help identify performance bottlenecks and optimize initialization times.

## Features

- Interactive timeline visualization of Spring Boot startup events
- Color-coded categorization of different startup phases:
  - 🟢 Application Components
  - 🔵 Context Initialization
  - 🟣 Bean Creation
  - 🟡 Web Configuration
  - ⚪ General Startup Tasks
- Detailed event information including:
  - Duration
  - Start/End timestamps
  - Parent-child relationships
  - Tag metadata
- Filtering capabilities by:
  - Event tags
  - Minimum duration
- Collapsible event tree structure
- JSON input via file upload or direct editing
- Metadata summary showing total startup time and events

## Usage

1. Enable the startup actuator endpoint in your Spring Boot application:

    ```yaml
    management:
    endpoint:
        startup:
        enabled: true
    endpoints:
        web:
        exposure:
            include: startup
    ```

2. Start your Spring Boot application and access `/actuator/startup` endpoint

3. Copy the JSON response and either:
   - Paste it into the JSON editor
   - Save it as a file and upload via the file input

4. The timeline will automatically render showing your application's startup sequence

## Local Development

1. Clone this repository
2. Open index.html in a web browser
3. CSS styles are in main.css
4. Timeline logic is in timeline.js

## Browser Support

This tool uses modern web technologies and is supported in all recent versions of:

- Chrome
- Firefox
- Safari
- Edge
