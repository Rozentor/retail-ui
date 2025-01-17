import React from 'react';

import { ThemeFactory } from '../../lib/theming/ThemeFactory';
import { Theme } from '../../lib/theming/Theme';
import { ThemeContext } from '../../lib/theming/ThemeContext';
import { PopupMenu, PopupMenuProps } from '../../internal/PopupMenu';
import { MenuItemProps } from '../MenuItem';
import { isProductionEnv, isTestEnv } from '../../lib/currentEnvironment';
import { MenuHeaderProps } from '../MenuHeader';
import { PopupPosition } from '../../internal/Popup';

export type TooltipMenuChildType = React.ReactElement<MenuItemProps | {} | MenuHeaderProps>;

export interface TooltipMenuProps {
  children?: TooltipMenuChildType | TooltipMenuChildType[];
  /** Максимальная высота меню */
  menuMaxHeight?: number | string;
  /** Ширина меню */
  menuWidth?: number | string;
  /**
   * Элемент или функция возвращающая элемент,
   * если передана, используется вместо ```caption```,
   * в таком случае управлять открытием и закрытием меню
   * придется в этой функции
   */
  caption: PopupMenuProps['caption'];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /**  Массив разрешенных положений меню относительно caption'а. */
  positions?: PopupPosition[];
  /**
   * Не показывать анимацию
   */
  disableAnimations: boolean;
}

/**
 * Меню, раскрывающееся по клику на переданный в ```caption``` элемент.
 * Положение зависит от переданного массива ```positions``` и работает так:
 * первое значаение в массиве - дефолтная позиция, меню раскрывается так, если ничего не мешает ему раскрыться,
 * если раскрыться в данной позиции не получается - берется следующие значение, и так далее.
 * Если меню должно раскрываться только в одну сторону - передаем в ```positions``` массив с одним элементом.
 * Если ```positions``` передан или передан пустой массив, используются все возможные положения.
 */
export class TooltipMenu extends React.Component<TooltipMenuProps> {
  private theme!: Theme;
  public static __KONTUR_REACT_UI__ = 'TooltipMenu';

  public static defaultProps = {
    disableAnimations: isTestEnv,
  };
  constructor(props: TooltipMenuProps) {
    super(props);

    if (!props.caption && !isProductionEnv) {
      throw new Error('Prop "caption" is required!!!');
    }
  }

  public render() {
    return (
      <ThemeContext.Consumer>
        {theme => {
          this.theme = theme;
          return (
            <ThemeContext.Provider
              value={ThemeFactory.create(
                {
                  popupPinOffset: '15px',
                  popupMargin: '10px',
                },
                this.theme,
              )}
            >
              {this.renderMain()}
            </ThemeContext.Provider>
          );
        }}
      </ThemeContext.Consumer>
    );
  }

  public renderMain() {
    if (!this.props.caption) {
      return null;
    }

    return (
      <PopupMenu
        menuMaxHeight={this.props.menuMaxHeight}
        menuWidth={this.props.menuWidth}
        caption={this.props.caption}
        header={this.props.header}
        footer={this.props.footer}
        positions={this.props.positions}
        popupHasPin={true}
        disableAnimations={this.props.disableAnimations}
      >
        {this.props.children}
      </PopupMenu>
    );
  }
}
