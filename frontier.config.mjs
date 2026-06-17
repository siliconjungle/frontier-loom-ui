export default {
  appId: 'frontier-loom-ui',
  name: 'Frontier Loom UI',
  frontend: {
    root: '.',
    jsxImportSource: '@shapeshift-labs/frontier-dom',
    routes: [{
      id: 'swarm-dashboard',
      path: '/',
      file: 'src/client.tsx',
      title: 'Loom Swarm Dashboard',
      feature: 'loom-ui-dashboard',
      owner: '@shapeshift-labs/frontier-loom-ui',
      reads: ['/dashboard/summary', '/dashboard/jobs', '/dashboard/task-board', '/dashboard/agent-work', '/dashboard/human-actions', '/dashboard/time-series', '/dashboard/token-usage', '/dashboard/task-details', '/dashboard/artifacts'],
      writes: []
    }]
  },
  surfaces: {
    intents: [{
      id: 'loom-ui-dashboard',
      kind: 'page',
      title: 'Loom Swarm Dashboard',
      route: '/',
      status: 'implemented',
      owner: '@shapeshift-labs/frontier-loom-ui',
      tags: ['dark-mode', 'swarm', 'read-only-dashboard']
    }]
  },
  routeScenarios: {
    scenarios: [{
      id: 'dashboard-loads',
      route: '/',
      expected: {
        selectors: [{ selector: '#app', required: true }],
        text: ['Progress by day', 'Token cost', 'Board', 'Swarm', 'Questions', 'Backlog', 'To do', 'Active agents', 'Files changed']
      }
    }]
  }
};
