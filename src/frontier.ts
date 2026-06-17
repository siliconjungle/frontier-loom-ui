import { createViewManifest } from '@shapeshift-labs/frontier-view';

export function createLoomUiViewManifest() {
  return createViewManifest({
    id: 'frontier-loom-ui.dashboard',
    source: {
      path: '/dashboard',
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'object' },
          lanes: { type: 'array' },
          jobs: { type: 'array' },
          routing: { type: 'object' },
          backlog: { type: 'object' }
        }
      }
    },
    defaults: {
      object: 'panel.section',
      array: 'table.compact',
      string: 'text.mono',
      number: 'metric.count'
    },
    fields: {
      '/summary': { label: 'Summary', representation: 'metric.grid', mode: 'readonly' },
      '/lanes': { label: 'Lanes', representation: 'lane.board', mode: 'readonly' },
      '/jobs': { label: 'Jobs', representation: 'table.jobs', mode: 'readonly' },
      '/routing': { label: 'Routing', representation: 'policy.summary', mode: 'readonly' },
      '/backlog': { label: 'Backlog', representation: 'backlog.summary', mode: 'readonly' }
    },
    metadata: {
      theme: 'dark',
      renderer: '@shapeshift-labs/frontier-dom/jsx-runtime'
    }
  });
}
