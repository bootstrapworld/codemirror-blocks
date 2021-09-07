class Announcer {
  private queuedAnnouncement: ReturnType<typeof setTimeout>;
  private announcerElement: HTMLElement;
  muted: boolean;
  
  constructor(mountPoint: HTMLElement) {
    this.announcerElement = document.createElement('div');
    this.announcerElement.setAttribute('aria-live', 'assertive');
    this.announcerElement.setAttribute('aria-atomic', 'true');
    mountPoint.appendChild(this.announcerElement);
  }

  /**
   * Make a screenreader announce something to the user
   * 
   * @param text the text to say
   * @param delay how long to wait (in ms) before making the announcement
   * @param allowOverride whether or not this announcement can be overridden
   * 
   * @internal
   */
  say(text: string, delay=200, allowOverride=false) {
    if (this.muted) {
      return;
    }
    const announcement = document.createTextNode(text);

    clearTimeout(this.queuedAnnouncement);            // clear anything overrideable
    
    if (allowOverride) {                          // enqueue overrideable announcements
      this.queuedAnnouncement = setTimeout(() => say('Use enter to edit', 0), delay);
    } else {                                           // otherwise write it to the DOM,
      this.announcerElement.childNodes.forEach( c => c.remove() ); // remove the children
      console.log('say:', text);                       // then erase it 10ms later
      setTimeout(() => this.announcerElement.appendChild(announcement), delay);
    }
  }
  
  /**
   * Cancels a delayed announcement if there is one in the queue
   * and it is allowed to be overridden.
   * @internal
   */
  cancelAnnouncement() {
    clearTimeout(this.queuedAnnouncement);
  }
}
let announcerSingleton:Announcer;
/**
 * Create an announcer instance at the given mount point in the DOM.
 * This function must be called before the {@link say} function will
 * do anything.
 */
export function mountAnnouncer(mountPoint: HTMLElement) {
  announcerSingleton = new Announcer(mountPoint);
}

/**
 * Make a screenreader announce something to the user
 * 
 * Note: {@link mountAnnouncer} must have been called first.
 * 
 * Note: screenreaders will automatically speak items with aria-labels!
 * This handles _everything_else_.
 * 
 * @param text the text to say
 * @param delay how long to wait (in ms) before making the announcement
 * @param allowOverride whether or not this announcement can be overridden
 * 
 * @internal
 */
export function say(text: string, delay=200, allowOverride=false) {
  if (announcerSingleton) {
    announcerSingleton.say(text, delay, allowOverride);
  }
}

/**
 * Cancels a delayed announcement if there is one in the queue
 * and it is allowed to be overridden.
 * @internal
 */
export function cancelAnnouncement() {
  if (announcerSingleton) {
    announcerSingleton.cancelAnnouncement();
  }
}

/**
 * Mute/unmute the announcer.
 * @param muted whether or not the announcer should be muted
 */
export function setMuted(muted:boolean) {
  if (announcerSingleton) {
    announcerSingleton.muted = muted;
  }
}