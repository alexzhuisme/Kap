import TrafficLights from '../traffic-lights';
import VideoPlayer from './video-player';
import Options from './options';
import useEditorWindowState from 'hooks/editor/use-editor-window-state';
import {useState, useRef, useEffect, useCallback} from 'react';

const TOP_BAR_HIDE_DELAY_MS = 200;

const EditorPreview = () => {
  const {title = 'Editor'} = useEditorWindowState();
  const [topBarVisible, setTopBarVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== undefined) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const onTopZoneEnter = useCallback(() => {
    clearHideTimer();
    setTopBarVisible(true);
  }, [clearHideTimer]);

  const onTopZoneLeave = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setTopBarVisible(false);
      hideTimerRef.current = undefined;
    }, TOP_BAR_HIDE_DELAY_MS);
  }, [clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  return (
    <div className="preview-container">
      <div className="preview-hover-container">
        <div
          className="top-title-hover-zone"
          onMouseEnter={onTopZoneEnter}
          onMouseLeave={onTopZoneLeave}
        >
          <div className={`title-bar${topBarVisible ? ' is-visible' : ''}`}>
            <div className="title-bar-container">
              <TrafficLights/>
              <div className="title">{title}</div>
            </div>
          </div>
        </div>
        <VideoPlayer/>
      </div>
      <Options/>
      <style jsx>{`
        .preview-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .preview-hover-container {
          display: flex;
          flex: 1;
          min-height: 0;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        /* Top strip uses JS hover (not CSS :hover). Visible title bar uses drag so the
           window can be moved; traffic lights keep no-drag in traffic-lights.tsx. */
        .top-title-hover-zone {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 36px;
          z-index: 11;
          pointer-events: auto;
          -webkit-app-region: no-drag;
        }

        .title-bar {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 36px;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(20px);
          display: flex;
          transform: translateY(-100%);
          opacity: 0;
          transition: transform 0.12s ease-in-out, opacity 0.12s ease-in-out;
          pointer-events: none;
        }

        .title-bar.is-visible {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
          -webkit-app-region: drag;
        }

        .title-bar-container {
          flex: 1;
          height: 100%;
          display: flex;
          align-items: center;
        }

        .title {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
          color: #fff;
          margin-left: -72px;
        }
      `}</style>
    </div>
  );
};

export default EditorPreview;
