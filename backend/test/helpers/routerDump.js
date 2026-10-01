/**
 * Inspects the Express router stack so these tests can be written against
 * names rather than layer indexes.
 *
 *   node -e "const d=require('./test/helpers/routerDump'); console.log(d.dump(require('./routes/adminRoutes')))"
 */
function dump(router) {
  return router.stack.map((layer, index) => ({
    index,
    kind: layer.route ? 'route' : layer.name || 'layer',
    path: layer.route ? layer.route.path : '',
    methods: layer.route ? Object.keys(layer.route.methods).join('|') : ''
  }));
}

function stack(router) {
  return router.stack;
}

module.exports = { dump, stack };