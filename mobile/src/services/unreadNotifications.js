/** عدّاد الإشعارات غير المقروءة، مشترك بين الجرس وصفحة الإشعارات. */
const listeners = new Set();
let count = 0;

export function getUnreadCount() {
  return count;
}

export function setUnreadCount(next) {
  count = Math.max(0, Number(next) || 0);
  listeners.forEach((fn) => fn(count));
}

export function subscribeUnread(fn) {
  listeners.add(fn);
  fn(count);
  return () => listeners.delete(fn);
}

let timer = null;
let watching = "";

export function watchUnread(userId, fetcher) {
  if (!userId) return;
  if (watching === userId && timer) return;
  watching = userId;
  if (timer) clearInterval(timer);
  const load = () => {
    Promise.resolve(fetcher(userId)).then((n) => setUnreadCount(n)).catch(() => {});
  };
  load();
  timer = setInterval(load, 25000);
}
