import { useSideRail } from './useSideRail';

/**
 * True on a regular iPhone, where a button that opens another page shows an
 * icon instead of a text label. The control keeps the text as its
 * accessibilityLabel so VoiceOver still reads it.
 *
 * On the iPhone Duo the page buttons in the header move to the side column
 * (see useSideColumnBack) and in-content buttons keep their labels, so this is
 * false there.
 */
export const useIconOnlyNav = (): boolean => !useSideRail();
