import { renderMarkdown } from './chat-markdown.js';

const QUESTIONS = [
  'What Projects has he Built',
  'What is he studying',
  'Tell me about his AI research',
  'Tell me about his TEDx Talk'
];
const WELCOME = "Hi there! 👋 I'm Arvin's AI portfolio assistant. Curious about his AI projects, technical skills, experience, or professional journey? Ask me anything!";
const icon = paths => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const sparkle = icon('<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>');

class FloatingChatWidget {
  constructor() {
    this.history = []; // Existing API contract: [{ role: 'user' | 'model', content }].
    this.open = false;
    this.loading = false;
    this.unread = false;
    this.followLatest = true;
    this.root = document.createElement('aside');
    this.root.className = 'floating-chat';
    this.root.setAttribute('aria-label', 'AI portfolio assistant');
    this.root.innerHTML = `
      <div class="chat-tooltip" id="chat-tooltip" hidden>Curious about my work? Ask my AI.</div>
      <section class="chat-panel" id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" aria-hidden="true" inert>
        <header class="chat-header">
          <span class="chat-avatar" aria-hidden="true">${sparkle}</span>
          <div class="chat-heading"><h2 id="chat-title">Portfolio assistant</h2></div>
          <button class="chat-minimize" type="button" aria-label="Minimize chat">${icon('<path d="M6 12h12"/>')}</button>
        </header>
        <div class="chat-conversation">
          <div class="chat-messages" role="log" aria-label="Conversation with Arvin AI" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
          <button class="chat-jump" type="button" hidden>Latest messages</button>
        </div>
        <form class="chat-composer">
          <div class="chat-input-wrap">
            <label class="chat-sr-only" for="chat-input">Your question for Arvin AI</label>
            <textarea class="chat-input" id="chat-input" rows="1" placeholder="Ask me anything..." maxlength="2000" enterkeyhint="send"></textarea>
            <button class="chat-send" type="submit" aria-label="Send message" disabled>${icon('<path d="m22 2-7 20-4-9-9-4L22 2Z"/><path d="m22 2-11 11"/>')}</button>
          </div>
        </form>
      </section>
      <button class="chat-launcher" type="button" aria-label="Open portfolio assistant" aria-expanded="false" aria-controls="chat-panel">
        <svg class="chat-launch-icon" aria-hidden="true" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M23 15v5a3 3 0 0 1-3 3H10l-6 3V8a3 3 0 0 1 3-3h8"/><path d="m22 2 1.4 4.6L28 8l-4.6 1.4L22 14l-1.4-4.6L16 8l4.6-1.4L22 2Z"/><path d="M9 13h6m-6 5h9"/></svg>
        <svg class="chat-close-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg>
        <span class="chat-unread" hidden></span>
      </button>
      <div class="chat-sr-only chat-status" role="status" aria-live="polite"></div>`;
    document.body.append(this.root);
    this.panel = this.root.querySelector('.chat-panel');
    this.launcher = this.root.querySelector('.chat-launcher');
    this.input = this.root.querySelector('.chat-input');
    this.sendButton = this.root.querySelector('.chat-send');
    this.log = this.root.querySelector('.chat-messages');
    this.jump = this.root.querySelector('.chat-jump');
    this.status = this.root.querySelector('.chat-status');
    this.tooltip = this.root.querySelector('.chat-tooltip');
    this.addMessage('model', WELCOME);
    this.addSuggestions();
    this.bindEvents();
    this.updateViewport();
    this.showIntro();
  }

  addSuggestions() {
    this.suggestions = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'chat-suggestions-label';
    label.textContent = 'Explore his work';
    const buttons = document.createElement('div');
    buttons.className = 'chat-suggestions';
    for (const question of QUESTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-suggestion';
      button.textContent = question;
      button.addEventListener('click', () => { this.input.focus({ preventScroll: true }); this.send(question); });
      buttons.append(button);
    }
    this.suggestions.append(label, buttons);
    this.log.append(this.suggestions);
  }

  bindEvents() {
    this.launcher.addEventListener('click', () => this.setOpen(!this.open));
    this.root.querySelector('.chat-minimize').addEventListener('click', () => this.setOpen(false));
    document.addEventListener('keydown', event => {
      if (this.open && event.key === 'Escape' && !event.isComposing) { event.preventDefault(); this.setOpen(false); }
    });
    this.root.querySelector('form').addEventListener('submit', event => { event.preventDefault(); this.send(this.input.value); });
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); this.send(this.input.value); }
    });
    this.input.addEventListener('input', () => this.updateInput());
    this.log.addEventListener('scroll', () => {
      this.followLatest = this.isNearBottom();
      if (this.followLatest && this.open) this.markRead();
      this.jump.hidden = this.followLatest;
    }, { passive: true });
    this.jump.addEventListener('click', () => { this.scrollToLatest(true); this.input.focus({ preventScroll: true }); });
    window.addEventListener('resize', () => this.updateViewport(), { passive: true });
    window.visualViewport?.addEventListener('resize', () => this.updateViewport(), { passive: true });
    window.visualViewport?.addEventListener('scroll', () => this.updateViewport(), { passive: true });
  }

  updateViewport() {
    const viewport = window.visualViewport;
    this.root.style.setProperty('--chat-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
    // Lift the entire widget above an on-screen keyboard without scrolling the page.
    const inset = viewport && viewport.scale === 1 ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
    this.root.style.setProperty('--chat-keyboard-inset', `${inset}px`);
    if (this.open && this.followLatest) this.scrollToLatest();
  }

  showIntro() {
    try {
      if (sessionStorage.getItem('arvin-chat-intro-seen')) return;
      sessionStorage.setItem('arvin-chat-intro-seen', '1');
    } catch { /* The widget also works when browser storage is unavailable. */ }
    this.introTimer = window.setTimeout(() => {
      if (!this.open) this.tooltip.hidden = false;
      this.dismissTimer = window.setTimeout(() => { this.tooltip.hidden = true; }, 6000);
    }, 1000);
  }

  setOpen(open) {
    if (open === this.open) return;
    this.open = open;
    clearTimeout(this.introTimer);
    clearTimeout(this.dismissTimer);
    this.tooltip.hidden = true;
    if (open) this.returnFocus = document.activeElement;
    this.root.classList.toggle('is-open', open);
    this.panel.inert = !open;
    this.panel.setAttribute('aria-hidden', String(!open));
    this.launcher.setAttribute('aria-expanded', String(open));
    this.launcher.setAttribute('aria-label', open ? 'Minimize portfolio assistant' : 'Open portfolio assistant');
    if (open) {
      this.updateViewport();
      this.input.focus({ preventScroll: true });
      if (this.unread || this.followLatest) this.scrollToLatest();
      this.markRead();
    } else {
      const target = this.returnFocus?.isConnected && !this.panel.contains(this.returnFocus) ? this.returnFocus : this.launcher;
      target.focus({ preventScroll: true });
    }
  }

  updateInput() {
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(this.input.scrollHeight, 104)}px`;
    this.sendButton.disabled = this.loading || !this.input.value.trim();
  }

  isNearBottom() { return this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 64; }

  scrollToLatest(smooth = false) {
    this.followLatest = true;
    this.log.scrollTo({ top: this.log.scrollHeight, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
    this.jump.hidden = true;
    if (this.open) this.markRead();
  }

  markRead() {
    this.unread = false;
    this.root.querySelector('.chat-unread').hidden = true;
    this.launcher.setAttribute('aria-label', this.open ? 'Minimize portfolio assistant' : 'Open portfolio assistant');
  }

  addMessage(role, text) {
    const message = document.createElement('div');
    message.className = `chat-message${role === 'user' ? ' chat-message-user' : ''}`;
    const label = document.createElement('span');
    label.className = role === 'user' ? 'chat-message-label' : 'chat-sr-only';
    label.textContent = role === 'user' ? 'You' : 'Assistant';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (role === 'user') bubble.textContent = text;
    else bubble.innerHTML = renderMarkdown(text);
    message.append(label, bubble);
    this.log.append(message);
    return message;
  }

  setLoading(loading) {
    this.loading = loading;
    this.log.setAttribute('aria-busy', String(loading));
    this.root.querySelectorAll('.chat-suggestion, .chat-retry').forEach(button => { button.disabled = loading; });
    this.updateInput();
  }

  async send(raw, retry = false) {
    const message = raw.trim();
    if (!message || this.loading) return;
    this.failedMessage?.remove();
    this.failedMessage = null;
    if (!retry) {
      this.input.value = '';
      this.suggestions.hidden = true;
      this.addMessage('user', message);
    }
    this.setLoading(true);
    const thinking = this.addMessage('model', '');
    thinking.querySelector('.chat-bubble').innerHTML = '<div class="chat-thinking" aria-hidden="true"><span class="chat-dots"><span></span><span></span><span></span></span><span>Thinking…</span></div>';
    this.status.textContent = 'Arvin AI is thinking.';
    this.scrollToLatest();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: this.history }),
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok || data.error || typeof data.response !== 'string' || !data.response.trim()) throw new Error('Chat request failed');
      this.history.push({ role: 'user', content: message }, { role: 'model', content: data.response });
      thinking.remove();
      this.addMessage('model', data.response);
      this.status.textContent = this.open ? '' : 'Arvin AI has replied. Open the chat to read the response.';
    } catch (error) {
      thinking.remove();
      this.failedMessage = this.addMessage('model', error.name === 'AbortError' ? 'That took a little longer than expected. Please try again.' : "I couldn't connect just now. Please try again in a moment.");
      this.failedMessage.classList.add('chat-error');
      const label = document.createElement('span');
      label.className = 'chat-error-label';
      label.textContent = 'Let’s try that again';
      this.failedMessage.querySelector('.chat-bubble').prepend(label);
      const button = document.createElement('button');
      button.className = 'chat-retry';
      button.type = 'button';
      button.textContent = 'Retry question';
      button.addEventListener('click', () => { this.input.focus({ preventScroll: true }); this.send(message, true); });
      this.failedMessage.querySelector('.chat-bubble').append(button);
      this.status.textContent = 'The reply could not be loaded. You can retry your question.';
    } finally {
      clearTimeout(timeout);
      this.setLoading(false);
      if (!this.open || !this.followLatest) {
        this.unread = true;
        this.root.querySelector('.chat-unread').hidden = this.open;
        this.launcher.setAttribute('aria-label', this.open ? 'Minimize portfolio assistant' : 'Open portfolio assistant, unread reply');
        this.jump.textContent = 'New reply';
        this.jump.hidden = false;
      } else this.scrollToLatest();
    }
  }
}

new FloatingChatWidget();
