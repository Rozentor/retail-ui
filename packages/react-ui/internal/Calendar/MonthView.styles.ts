import { css, memoizeStyle } from '../../lib/theming/Emotion';
import { Theme } from '../../lib/theming/Theme';

const styles = {
  headerMonth() {
    return css`
      display: inline-block;
    `;
  },

  headerYear() {
    return css`
      display: inline-block;
      position: absolute;
      right: 0;
    `;
  },

  month(t: Theme) {
    const width = parseInt(t.calendarDayHeight) * 7 + parseInt(t.calendarDayMarginLeft) * 6;
    return css`
      position: absolute;
      width: ${width}px;
    `;
  },

  headerSticky(t: Theme) {
    return css`
      background-color: ${t.calendarMonthHeaderStickedBgColor};
      z-index: 1;
    `;
  },

  monthTitle(t: Theme) {
    return css`
      border-bottom: 1px solid ${t.calendarMonthTitleBorderBottomColor};
      font-weight: ${t.dateSelectFontWeight};
      margin-bottom: 10px;
      position: relative;
    `;
  },
};

export const jsStyles = memoizeStyle(styles);
