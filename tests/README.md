# Test harnesses

Each of these drives the REAL scene in Node with rendering and audio stubbed
out, and the bot reads the game state ONLY from what the scene draws - the
sprites it asks for, the rectangles it fills, the text it lays down. Nothing
reads hidden state, because a player cannot.

```bash
node tests/tour.js .
```

`tourbot.js` is the driver; `tour.js` is the suite. The eight per-event
harnesses live alongside them.

These used to live in a scratch directory outside the repository, which is
exactly as durable as it sounds - a temp clean wiped all nine of them. They
belong in here.
