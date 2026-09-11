# Spring Tools

Utilities for inspecting Spring Boot applications. The first tool is an in-browser **startup timeline**: paste `/actuator/startup` JSON and see which beans and phases dominate boot time.

## Install

No build step. Clone and open the HTML app.

```sh
git clone https://github.com/Dhi13man/spring_tools.git
cd spring_tools
```

Open `startup_timeline/src/index.html` in a current Chrome, Firefox, Safari, or Edge.

## Use

1. Enable the startup actuator in the Spring Boot app:

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

2. GET `/actuator/startup`, then paste or upload that JSON in the timeline UI.
3. Filter by tag or minimum duration to find slow bean creation and context init.

Details: [startup_timeline/README.MD](startup_timeline/README.MD).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
