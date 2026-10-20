"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "instrumentation";
exports.ids = ["instrumentation"];
exports.modules = {

/***/ "(instrument)/./src/instrumentation.ts":
/*!********************************!*\
  !*** ./src/instrumentation.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   onRequestError: () => (/* binding */ onRequestError),\n/* harmony export */   register: () => (/* binding */ register)\n/* harmony export */ });\n// Sentry is imported only when a DSN is set, so dev and mock builds skip it.\nconst dsn = process.env.SENTRY_DSN ?? \"\";\nasync function register() {\n    if (!dsn) return;\n    const [Sentry, { DATA_COLLECTION, scrubBreadcrumb, scrubEvent }] = await Promise.all([\n        Promise.all(/*! import() */[__webpack_require__.e(\"vendor-chunks/next@15.5.27_@babel+core@7._360954bc23504998cc60eebab9d28316\"), __webpack_require__.e(\"vendor-chunks/@opentelemetry+api@1.9.1\"), __webpack_require__.e(\"vendor-chunks/@swc+helpers@0.5.15\"), __webpack_require__.e(\"vendor-chunks/@sentry+conventions@0.26.0\"), __webpack_require__.e(\"vendor-chunks/@sentry+server-utils@11.6.0\"), __webpack_require__.e(\"vendor-chunks/@sentry+core@11.6.0\"), __webpack_require__.e(\"vendor-chunks/@sentry+server-runtime-injection@11.6.0\"), __webpack_require__.e(\"vendor-chunks/@sentry+node@11.6.0_@babel+core@7.29.7_rollup@4.64.5\"), __webpack_require__.e(\"vendor-chunks/@sentry+nextjs@11.6.0_@babe_0267d8bd5a2bd412cd266b67eaf85c54\"), __webpack_require__.e(\"vendor-chunks/@sentry+opentelemetry@11.6.0_@opentelemetry+api@1.9.1\"), __webpack_require__.e(\"vendor-chunks/stacktrace-parser@0.1.11\")]).then(__webpack_require__.t.bind(__webpack_require__, /*! @sentry/nextjs */ \"(instrument)/./node_modules/.pnpm/@sentry+nextjs@11.6.0_@babe_0267d8bd5a2bd412cd266b67eaf85c54/node_modules/@sentry/nextjs/build/cjs/index.server.js\", 23)),\n        __webpack_require__.e(/*! import() */ \"_instrument_src_shared_lib_monitoring_scrub_ts\").then(__webpack_require__.bind(__webpack_require__, /*! ./shared/lib/monitoring/scrub */ \"(instrument)/./src/shared/lib/monitoring/scrub.ts\"))\n    ]);\n    Sentry.init({\n        dsn,\n        environment: process.env.SENTRY_ENVIRONMENT ?? \"development\",\n        release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,\n        dataCollection: DATA_COLLECTION,\n        tracesSampleRate: 0,\n        beforeSend: scrubEvent,\n        beforeBreadcrumb: scrubBreadcrumb\n    });\n}\nconst onRequestError = async (...args)=>{\n    if (!dsn) return;\n    const Sentry = await Promise.all(/*! import() */[__webpack_require__.e(\"vendor-chunks/next@15.5.27_@babel+core@7._360954bc23504998cc60eebab9d28316\"), __webpack_require__.e(\"vendor-chunks/@opentelemetry+api@1.9.1\"), __webpack_require__.e(\"vendor-chunks/@swc+helpers@0.5.15\"), __webpack_require__.e(\"vendor-chunks/@sentry+conventions@0.26.0\"), __webpack_require__.e(\"vendor-chunks/@sentry+server-utils@11.6.0\"), __webpack_require__.e(\"vendor-chunks/@sentry+core@11.6.0\"), __webpack_require__.e(\"vendor-chunks/@sentry+server-runtime-injection@11.6.0\"), __webpack_require__.e(\"vendor-chunks/@sentry+node@11.6.0_@babel+core@7.29.7_rollup@4.64.5\"), __webpack_require__.e(\"vendor-chunks/@sentry+nextjs@11.6.0_@babe_0267d8bd5a2bd412cd266b67eaf85c54\"), __webpack_require__.e(\"vendor-chunks/@sentry+opentelemetry@11.6.0_@opentelemetry+api@1.9.1\"), __webpack_require__.e(\"vendor-chunks/stacktrace-parser@0.1.11\")]).then(__webpack_require__.t.bind(__webpack_require__, /*! @sentry/nextjs */ \"(instrument)/./node_modules/.pnpm/@sentry+nextjs@11.6.0_@babe_0267d8bd5a2bd412cd266b67eaf85c54/node_modules/@sentry/nextjs/build/cjs/index.server.js\", 23));\n    Sentry.captureRequestError(...args);\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vc3JjL2luc3RydW1lbnRhdGlvbi50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUFBLDZFQUE2RTtBQUc3RSxNQUFNQSxNQUFNQyxRQUFRQyxHQUFHLENBQUNDLFVBQVUsSUFBSUYsRUFBa0M7QUFFakUsZUFBZUk7SUFDcEIsSUFBSSxDQUFDTCxLQUFLO0lBQ1YsTUFBTSxDQUFDTSxRQUFRLEVBQUVDLGVBQWUsRUFBRUMsZUFBZSxFQUFFQyxVQUFVLEVBQUUsQ0FBQyxHQUFHLE1BQU1DLFFBQVFDLEdBQUcsQ0FBQztRQUNuRiwwbENBQXdCO1FBQ3hCLHFPQUF1QztLQUN4QztJQUNETCxPQUFPTSxJQUFJLENBQUM7UUFDVlo7UUFDQWEsYUFBYVosUUFBUUMsR0FBRyxDQUFDWSxrQkFBa0IsSUFiL0M7UUFjSUMsU0FBU2QsUUFBUUMsR0FBRyxDQUFDYywwQkFBMEI7UUFDL0NDLGdCQUFnQlY7UUFDaEJXLGtCQUFrQjtRQUNsQkMsWUFBWVY7UUFDWlcsa0JBQWtCWjtJQUNwQjtBQUNGO0FBRU8sTUFBTWEsaUJBQWlELE9BQU8sR0FBR0M7SUFDdEUsSUFBSSxDQUFDdEIsS0FBSztJQUNWLE1BQU1NLFNBQVMsTUFBTSwwbENBQXdCO0lBQzdDQSxPQUFPaUIsbUJBQW1CLElBQUlEO0FBQ2hDLEVBQUUiLCJzb3VyY2VzIjpbIkQ6XFxsZWFkZXhwYVxcZnJvbnRlbmRcXHNyY1xcaW5zdHJ1bWVudGF0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIFNlbnRyeSBpcyBpbXBvcnRlZCBvbmx5IHdoZW4gYSBEU04gaXMgc2V0LCBzbyBkZXYgYW5kIG1vY2sgYnVpbGRzIHNraXAgaXQuXG5pbXBvcnQgdHlwZSB7IEluc3RydW1lbnRhdGlvbiB9IGZyb20gXCJuZXh0XCI7XG5cbmNvbnN0IGRzbiA9IHByb2Nlc3MuZW52LlNFTlRSWV9EU04gPz8gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfU0VOVFJZX0RTTjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZ2lzdGVyKCkge1xuICBpZiAoIWRzbikgcmV0dXJuO1xuICBjb25zdCBbU2VudHJ5LCB7IERBVEFfQ09MTEVDVElPTiwgc2NydWJCcmVhZGNydW1iLCBzY3J1YkV2ZW50IH1dID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIGltcG9ydChcIkBzZW50cnkvbmV4dGpzXCIpLFxuICAgIGltcG9ydChcIi4vc2hhcmVkL2xpYi9tb25pdG9yaW5nL3NjcnViXCIpLFxuICBdKTtcbiAgU2VudHJ5LmluaXQoe1xuICAgIGRzbixcbiAgICBlbnZpcm9ubWVudDogcHJvY2Vzcy5lbnYuU0VOVFJZX0VOVklST05NRU5UID8/IHByb2Nlc3MuZW52Lk5PREVfRU5WLFxuICAgIHJlbGVhc2U6IHByb2Nlc3MuZW52Lk5FWFRfUFVCTElDX1NFTlRSWV9SRUxFQVNFLFxuICAgIGRhdGFDb2xsZWN0aW9uOiBEQVRBX0NPTExFQ1RJT04sXG4gICAgdHJhY2VzU2FtcGxlUmF0ZTogMCxcbiAgICBiZWZvcmVTZW5kOiBzY3J1YkV2ZW50LFxuICAgIGJlZm9yZUJyZWFkY3J1bWI6IHNjcnViQnJlYWRjcnVtYixcbiAgfSk7XG59XG5cbmV4cG9ydCBjb25zdCBvblJlcXVlc3RFcnJvcjogSW5zdHJ1bWVudGF0aW9uLm9uUmVxdWVzdEVycm9yID0gYXN5bmMgKC4uLmFyZ3MpID0+IHtcbiAgaWYgKCFkc24pIHJldHVybjtcbiAgY29uc3QgU2VudHJ5ID0gYXdhaXQgaW1wb3J0KFwiQHNlbnRyeS9uZXh0anNcIik7XG4gIFNlbnRyeS5jYXB0dXJlUmVxdWVzdEVycm9yKC4uLmFyZ3MpO1xufTtcbiJdLCJuYW1lcyI6WyJkc24iLCJwcm9jZXNzIiwiZW52IiwiU0VOVFJZX0RTTiIsIk5FWFRfUFVCTElDX1NFTlRSWV9EU04iLCJyZWdpc3RlciIsIlNlbnRyeSIsIkRBVEFfQ09MTEVDVElPTiIsInNjcnViQnJlYWRjcnVtYiIsInNjcnViRXZlbnQiLCJQcm9taXNlIiwiYWxsIiwiaW5pdCIsImVudmlyb25tZW50IiwiU0VOVFJZX0VOVklST05NRU5UIiwicmVsZWFzZSIsIk5FWFRfUFVCTElDX1NFTlRSWV9SRUxFQVNFIiwiZGF0YUNvbGxlY3Rpb24iLCJ0cmFjZXNTYW1wbGVSYXRlIiwiYmVmb3JlU2VuZCIsImJlZm9yZUJyZWFkY3J1bWIiLCJvblJlcXVlc3RFcnJvciIsImFyZ3MiLCJjYXB0dXJlUmVxdWVzdEVycm9yIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(instrument)/./src/instrumentation.ts\n");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ "node:async_hooks":
/*!***********************************!*\
  !*** external "node:async_hooks" ***!
  \***********************************/
/***/ ((module) => {

module.exports = require("node:async_hooks");

/***/ }),

/***/ "node:child_process":
/*!*************************************!*\
  !*** external "node:child_process" ***!
  \*************************************/
/***/ ((module) => {

module.exports = require("node:child_process");

/***/ }),

/***/ "node:crypto":
/*!******************************!*\
  !*** external "node:crypto" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("node:crypto");

/***/ }),

/***/ "node:diagnostics_channel":
/*!*******************************************!*\
  !*** external "node:diagnostics_channel" ***!
  \*******************************************/
/***/ ((module) => {

module.exports = require("node:diagnostics_channel");

/***/ }),

/***/ "node:events":
/*!******************************!*\
  !*** external "node:events" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("node:events");

/***/ }),

/***/ "node:fs":
/*!**************************!*\
  !*** external "node:fs" ***!
  \**************************/
/***/ ((module) => {

module.exports = require("node:fs");

/***/ }),

/***/ "node:http":
/*!****************************!*\
  !*** external "node:http" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:http");

/***/ }),

/***/ "node:https":
/*!*****************************!*\
  !*** external "node:https" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("node:https");

/***/ }),

/***/ "node:inspector":
/*!*********************************!*\
  !*** external "node:inspector" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("node:inspector");

/***/ }),

/***/ "node:module":
/*!******************************!*\
  !*** external "node:module" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("node:module");

/***/ }),

/***/ "node:net":
/*!***************************!*\
  !*** external "node:net" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("node:net");

/***/ }),

/***/ "node:os":
/*!**************************!*\
  !*** external "node:os" ***!
  \**************************/
/***/ ((module) => {

module.exports = require("node:os");

/***/ }),

/***/ "node:path":
/*!****************************!*\
  !*** external "node:path" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:path");

/***/ }),

/***/ "node:readline":
/*!********************************!*\
  !*** external "node:readline" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("node:readline");

/***/ }),

/***/ "node:stream":
/*!******************************!*\
  !*** external "node:stream" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("node:stream");

/***/ }),

/***/ "node:tls":
/*!***************************!*\
  !*** external "node:tls" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("node:tls");

/***/ }),

/***/ "node:tty":
/*!***************************!*\
  !*** external "node:tty" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("node:tty");

/***/ }),

/***/ "node:url":
/*!***************************!*\
  !*** external "node:url" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("node:url");

/***/ }),

/***/ "node:util":
/*!****************************!*\
  !*** external "node:util" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:util");

/***/ }),

/***/ "node:worker_threads":
/*!**************************************!*\
  !*** external "node:worker_threads" ***!
  \**************************************/
/***/ ((module) => {

module.exports = require("node:worker_threads");

/***/ }),

/***/ "node:zlib":
/*!****************************!*\
  !*** external "node:zlib" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:zlib");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ "perf_hooks":
/*!*****************************!*\
  !*** external "perf_hooks" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("perf_hooks");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "worker_threads":
/*!*********************************!*\
  !*** external "worker_threads" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("worker_threads");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("./webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(instrument)/./src/instrumentation.ts"));
module.exports = __webpack_exports__;

})();