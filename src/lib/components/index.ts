// ============================================================================
// FrostGuard Design System — Layer 1 Barrel Export
// Import: import { Button, Badge, Card, ... } from '@/lib/components';
// ============================================================================

// Design System
export { cn } from '@/lib/design-system/cn';
export * from '@/lib/design-system/tokens';
export * from '@/lib/design-system/animations';

// Elements
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './elements/Button';
export { Badge, type BadgeProps, type BadgeSize } from './elements/Badge';
export { Dot, type DotProps } from './elements/Dot';
export { Avatar, type AvatarProps, type AvatarSize } from './elements/Avatar';
export { AvatarGroup, type AvatarGroupProps } from './elements/AvatarGroup';
export { Divider, type DividerProps } from './elements/Divider';
export { KBD, type KBDProps } from './elements/KBD';
export { Chip, type ChipProps } from './elements/Chip';
export { ChipGroup, type ChipGroupProps } from './elements/ChipGroup';
export { IconButton, type IconButtonProps } from './elements/IconButton';
export { LinkButton, type LinkButtonProps } from './elements/LinkButton';
export { ButtonGroup, type ButtonGroupProps } from './elements/ButtonGroup';

// Feedback
export { Spinner, type SpinnerProps } from './feedback/Spinner';
export { Skeleton, type SkeletonProps } from './feedback/Skeleton';
export { EmptyState, type EmptyStateProps } from './feedback/EmptyState';
export { ErrorState, type ErrorStateProps } from './feedback/ErrorState';
export { NotFoundState, type NotFoundStateProps } from './feedback/NotFoundState';
export { Alert, type AlertProps } from './feedback/Alert';
export { AlertInline, type AlertInlineProps } from './feedback/AlertInline';
export { Toast, type ToastProps } from './feedback/Toast';
export { ToastProvider, useToasts } from './feedback/ToastProvider';
export { ProgressBar, type ProgressBarProps } from './feedback/ProgressBar';
export { ProgressRing, type ProgressRingProps } from './feedback/ProgressRing';

// Layout
export { Card, type CardProps, type CardVariant } from './layout/Card';
export { Container, type ContainerProps } from './layout/Container';
export { MediaObject, type MediaObjectProps } from './layout/MediaObject';
export { CardGrid, type CardGridProps } from './layout/CardGrid';
export { SplitView, type SplitViewProps } from './layout/SplitView';
export { StickyHeader, type StickyHeaderProps } from './layout/StickyHeader';

// Headings
export { PageHeading, type PageHeadingProps } from './headings/PageHeading';
export { SectionHeading, type SectionHeadingProps } from './headings/SectionHeading';
export { CardHeading, type CardHeadingProps } from './headings/CardHeading';

// Navigation
export { SidebarNav, type SidebarNavProps } from './navigation/SidebarNav';
export { SidebarNavItem, type SidebarNavItemProps } from './navigation/SidebarNavItem';
export { SidebarNavGroup, type SidebarNavGroupProps } from './navigation/SidebarNavGroup';
export { Navbar, type NavbarProps } from './navigation/Navbar';
export { TabNav, type TabNavProps, type TabNavItem } from './navigation/TabNav';
export { Breadcrumbs, type BreadcrumbsProps, type BreadcrumbItem } from './navigation/Breadcrumbs';
export { Pagination, type PaginationProps } from './navigation/Pagination';
export { VerticalNav, type VerticalNavProps, type VerticalNavItem } from './navigation/VerticalNav';
export { CommandPalette, type CommandPaletteProps, type CommandPaletteItem } from './navigation/CommandPalette';

// Application Shells
export { SidebarLayout, type SidebarLayoutProps } from './application-shells/SidebarLayout';
export { StackedLayout, type StackedLayoutProps } from './application-shells/StackedLayout';
export { MultiColumnLayout, type MultiColumnLayoutProps } from './application-shells/MultiColumnLayout';
export { ShellProvider, useShell } from './application-shells/ShellContext';

// Data Display
export { StatCard, type StatCardProps } from './data-display/StatCard';
export { StatGroup, type StatGroupProps } from './data-display/StatGroup';
export { DescriptionList, type DescriptionListProps, type DescriptionListItem } from './data-display/DescriptionList';
export { StackedList, type StackedListProps } from './data-display/StackedList';
export { StackedListItem, type StackedListItemProps } from './data-display/StackedListItem';
export { Timeline, type TimelineProps } from './data-display/Timeline';
export { TimelineItem, type TimelineItemProps } from './data-display/TimelineItem';
export { Feed, type FeedProps } from './data-display/Feed';
export { FeedItem, type FeedItemProps } from './data-display/FeedItem';
export { GridList, type GridListProps } from './data-display/GridList';
export { GridListItem, type GridListItemProps } from './data-display/GridListItem';
export { Calendar, type CalendarProps } from './data-display/Calendar';
export { DataTable, type DataTableProps, type DataTableColumn } from './data-display/DataTable';
export { DataTableHeader, type DataTableHeaderProps } from './data-display/DataTableHeader';
export { DataTableRow, type DataTableRowProps } from './data-display/DataTableRow';
export { DataTablePagination, type DataTablePaginationProps } from './data-display/DataTablePagination';
export { DataTableToolbar, type DataTableToolbarProps } from './data-display/DataTableToolbar';
export { DataTableEmpty, type DataTableEmptyProps } from './data-display/DataTableEmpty';

// Forms
export { InputGroup, StyledInput, type InputGroupProps, type StyledInputProps } from './forms/InputGroup';
export { InputWithAddon, type InputWithAddonProps } from './forms/InputWithAddon';
export { InputWithInlineAddon, type InputWithInlineAddonProps } from './forms/InputWithInlineAddon';
export { FormLayout, type FormLayoutProps } from './forms/FormLayout';
export { FormSection, type FormSectionProps } from './forms/FormSection';
export { FormActions, type FormActionsProps } from './forms/FormActions';
export { SelectMenu, type SelectMenuProps, type SelectMenuOption } from './forms/SelectMenu';
export { ComboboxInput, type ComboboxInputProps, type ComboboxOption } from './forms/ComboboxInput';
export { RadioGroupCards, type RadioGroupCardsProps } from './forms/RadioGroupCards';
export { RadioGroupList, type RadioGroupListProps } from './forms/RadioGroupList';
export { CheckboxGroup, type CheckboxGroupProps } from './forms/CheckboxGroup';
export { ToggleSwitch, type ToggleSwitchProps } from './forms/ToggleSwitch';
export { TextareaInput, type TextareaInputProps } from './forms/TextareaInput';
export { SearchInput, type SearchInputProps } from './forms/SearchInput';
export { NumberStepper, type NumberStepperProps } from './forms/NumberStepper';
export { FileUpload, type FileUploadProps } from './forms/FileUpload';
export { DatePicker, type DatePickerProps } from './forms/DatePicker';
export { DateRangePicker, type DateRangePickerProps, type DateRange } from './forms/DateRangePicker';
export { SignInForm, type SignInFormProps } from './forms/SignInForm';
export { ActionPanel, type ActionPanelProps } from './forms/ActionPanel';

// Overlays
export { ModalDialog, type ModalDialogProps, type ModalSize } from './overlays/ModalDialog';
export { SlideOverPanel, type SlideOverPanelProps } from './overlays/SlideOverPanel';
export { ConfirmDialog, type ConfirmDialogProps } from './overlays/ConfirmDialog';
export { Popover, type PopoverProps } from './overlays/Popover';
export { Tooltip, type TooltipProps } from './overlays/Tooltip';
export { DropdownMenu, type DropdownMenuProps, type DropdownMenuItem, type DropdownMenuGroup } from './overlays/DropdownMenu';
export { ContextMenu, type ContextMenuProps, type ContextMenuItem } from './overlays/ContextMenu';
export { NotificationPanel, type NotificationPanelProps, type NotificationItem } from './overlays/NotificationPanel';
