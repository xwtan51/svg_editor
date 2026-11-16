/** Loader fixture: evaluating the module throws (a two-line message; only the first line is the reason). */
throw new Error("fixture fails while loading\nsecond line of the message");
