/**
 * @file chromecast-button.js
 */
import videojs from 'video.js';
import loadMedia from '../chromecast/load.js';

const Component = videojs.getComponent('Component');
const ControlBar = videojs.getComponent('ControlBar');
const Button = videojs.getComponent('Button');

/**
 * The base class for buttons that toggle chromecast video
 *
 * @param {Player|Object} player
 * @param {Object=} options
 * @extends Button
 * @class ChromeCastButton
 */
class ChromeCastButton extends Button {

    constructor (player, options) {
        super(player, options);
        this.hide();
        this.initializeApi();
        options.appId = player.options_.chromecast.appId;
        player.chromecast = this;

        this.on(player, 'loadstart', () => {
          if (this.casting && this.apiInitialized) {
            this.onSessionSuccess(this.apiSession);
          }
        });
    }

    /**
     * Init chromecast sdk api
     *
     * @method initializeApi
     */

    initializeApi () {
        let apiConfig;
        let appId;
        let sessionRequest;

        if (!videojs.browser.IS_CHROME || videojs.browser.IS_EDGE) {
            return;
        }
        if (!chrome.cast || !chrome.cast.isAvailable) {
            videojs.log('Cast APIs not available');
            if (this.tryingReconnect < 10) {
                this.setTimeout(this.initializeApi, 1000);
                ++this.tryingReconnect;
            }
            videojs.log('Cast APIs not available. Max reconnect attempt');
            return;
        }

        videojs.log('Cast APIs are available');
        appId = this.options_.appId || chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
        sessionRequest = new chrome.cast.SessionRequest(appId);
        apiConfig = new chrome.cast.ApiConfig(sessionRequest, ::this.sessionJoinedListener, ::this.receiverListener);

        return chrome.cast.initialize(apiConfig, ::this.onInitSuccess, ::this.castError);
    }

    castError (castError) {
        let error = {
            code: castError.code,
            message: castError.description
        };

        switch (castError.code) {
            case chrome.cast.ErrorCode.API_NOT_INITIALIZED:
            case chrome.cast.ErrorCode.EXTENSION_MISSING:
            case chrome.cast.ErrorCode.EXTENSION_NOT_COMPATIBLE:
            case chrome.cast.ErrorCode.INVALID_PARAMETER:
            case chrome.cast.ErrorCode.LOAD_MEDIA_FAILED:
            case chrome.cast.ErrorCode.RECEIVER_UNAVAILABLE:
            case chrome.cast.ErrorCode.SESSION_ERROR:
            case chrome.cast.ErrorCode.CHANNEL_ERROR:
            case chrome.cast.ErrorCode.TIMEOUT:
                this.addClass('error');
                break;
            case chrome.cast.ErrorCode.CANCEL:
                break;
            default:
                this.player_.error(error);
                break;
        }
        return videojs.log('Cast Error: ' + (JSON.stringify(castError)));
    }

    onInitSuccess () {
        return this.apiInitialized = true;
    }

    sessionJoinedListener (session) {
        if (session.media.length) {
            this.apiSession = session;
            this.onMediaDiscovered(session.media[0]);
        }
        return console.log('Session joined');
    }

    receiverListener (availability) {
        if (availability === 'available') {
            return this.show();
        }
    }

    doLaunch () {
        videojs.log('Cast video: ' + (this.player_.cache_.src));
        if (this.apiInitialized) {
            return chrome.cast.requestSession(::this.onSessionSuccess, ::this.castError);
        } else {
            return videojs.log('Session not initialized');
        }
    }

    onSessionSuccess (session) {
      this.apiSession = session;
      this.player_.pause(); //Pause the current playing content until cast has loaded

      //TODO: Did I remove too much? :O
      const loadRequest = new loadMedia(
        this.player_.cache_.src, this.player_.currentType()
      );

      loadRequest.setCurrentTime(this.player_.currentTime());
      this.apiSession.loadMedia(loadRequest.request(), ::this.onMediaDiscovered, ::this.castError);
      this.apiSession.addUpdateListener(::this.onSessionUpdate);
    }

    onMediaDiscovered (media) {
        this.player_.loadTech_('Chromecast', {
            type: 'cast',
            apiMedia: media,
            apiSession: this.apiSession
        });

        this.casting = true;
        this.inactivityTimeout = this.player_.options_.inactivityTimeout;
        this.player_.options_.inactivityTimeout = 0;
        this.player_.userActive(true);
        this.addClass('connected');
        this.removeClass('error');
    }

    onSessionUpdate (isAlive) {
        if (!this.player_.apiMedia) {
            return;
        }
        if (!isAlive) {
            return this.onStopAppSuccess();
        }
    }

    stopCasting () {
        return this.apiSession.stop(::this.onStopAppSuccess, ::this.castError);
    }

    onStopAppSuccess () {
        this.casting = false;
        let time = this.player_.currentTime();
        this.removeClass('connected');
        this.player_.src(this.player_.options_['sources']);
        if (!this.player_.paused()) {
            this.player_.one('seeked', function () {
                return this.player_.play();
            });
        }
        this.player_.currentTime(time);
        this.player_.options_.inactivityTimeout = this.inactivityTimeout;
        return this.apiSession = null;
    }

    /**
     * Allow sub components to stack CSS class names
     *
     * @return {String} The constructed class name
     * @method buildCSSClass
     */
    buildCSSClass () {
        return `vjs-chromecast-button ${super.buildCSSClass()}`;
    }

    /**
     * Handle click on mute
     * @method handleClick
     */
    handleClick () {
        super.handleClick();
        if (this.casting) {
            return this.stopCasting();
        } else {
            return this.doLaunch();
        }
    }
}

ChromeCastButton.prototype.tryingReconnect = 0;

ChromeCastButton.prototype.inactivityTimeout = 2000;

ChromeCastButton.prototype.controlText_ = 'Chromecast';

//Replace videojs CaptionButton child with this one
ControlBar.prototype.options_.children.splice(ControlBar.prototype.options_.children.length - 1, 0, 'chromeCastButton');

Component.registerComponent('ChromeCastButton', ChromeCastButton);
export default ChromeCastButton;
