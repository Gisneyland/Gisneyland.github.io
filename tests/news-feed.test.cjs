const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/content.js'), 'utf8');

function setup(result) {
  function element(tag) {
    return {
      tag, children: [], dataset: {}, textContent: '',
      append(...children) { this.children.push(...children); },
      replaceChildren() { this.children = []; }
    };
  }
  const feed = element('div');
  feed.dataset.cardClass = 'event-card';
  const query = {
    select() { return this; }, eq() { return this; }, order() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
  };
  const context = vm.createContext({
    window: { questionnaireSupabase: { from: () => query } },
    document: {
      addEventListener() {},
      querySelectorAll: () => [feed],
      createElement: element
    },
    console: { warn() {} }
  });
  vm.runInContext(source, context);
  return { context, feed };
}

test('managed news has no build-time sample articles on either public page', () => {
  for (const filename of ['index.html', 'pages/news/index.html']) {
    const page = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.doesNotMatch(page, /site\.data\.news/);
    assert.match(page, /最新消息載入中/);
  }
});

test('news query failure shows an explicit status instead of sample stories', async () => {
  const { context, feed } = setup({ error: new Error('Offline') });
  await vm.runInContext('loadManagedNews()', context);
  assert.equal(feed.children.length, 1);
  assert.equal(feed.children[0].textContent, '目前無法載入最新消息，請稍後再試。');
});

test('empty published results show the empty state', async () => {
  const { context, feed } = setup({ data: [], error: null });
  await vm.runInContext('loadManagedNews()', context);
  assert.equal(feed.children[0].textContent, '目前沒有已上架的最新消息。');
});

test('only returned published news is rendered as text', async () => {
  const { context, feed } = setup({
    data: [{ category: '測試', title: '<script>not markup</script>', summary: '已上架消息' }], error: null
  });
  await vm.runInContext('loadManagedNews()', context);
  assert.equal(feed.children.length, 1);
  assert.equal(feed.children[0].children[1].textContent, '<script>not markup</script>');
});
