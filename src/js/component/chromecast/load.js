export default class Load {
  constructor(media, type) {
      this.mediaInfo = this.setMediaInfo(media);
      this.autoplay = true;
      this.currentTime = 0;
  }

  setMediaInfo(media, type) {
    const mediaInfo = new chrome.cast.media.MediaInfo(media, type);
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;

    return mediaInfo;
  }

  setAutoPlay(shouldAutoplay) {
    this.autoplay = shouldAutoplay;
    return this;
  }

  setCurrentTime(curTime) {
    this.currentTime = curTime;
    return this;
  }

  request() {
    const loadRequest = new chrome.cast.media.LoadRequest(this.mediaInfo);
    loadRequest.autoplay = this.autoplay;
    loadRequest.currentTime = this.currentTime;

    return loadRequest;
  }
}
