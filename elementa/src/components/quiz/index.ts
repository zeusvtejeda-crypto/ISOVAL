export { DEFAULT_EXIT_DESCRIPTION, ExitConfirm, type ExitConfirmProps } from './ExitConfirm';
export { FEEDBACK_PANEL_ATTR, revealAboveFeedback, revealScrollDelta, type VerticalSpan } from './feedback-reveal';
export { FEEDBACK_DELAY_MS, FeedbackPanel, type FeedbackPanelProps } from './FeedbackPanel';
export { ImmersiveHeader, type ImmersiveHeaderProps } from './ImmersiveHeader';
export { OptionButton, type OptionButtonProps, type OptionState } from './OptionButton';
export { hasShortOptions, QuestionCard, type QuestionCardProps } from './QuestionCard';
export { QuestionPrompt, type QuestionPromptProps } from './QuestionPrompt';
export { QuestionRenderer, type QuestionRendererProps } from './QuestionRenderer';
export { QuizHeader, type QuizHeaderProps } from './QuizHeader';
export { QuizScreen, type QuizScreenProps } from './QuizScreen';
export { isStreakMilestone, LivesIndicator, StreakChip, TimeChip } from './QuizStats';
export {
  buildSessionSummary,
  describeOption,
  EMPTY_TALLY,
  evaluateResponse,
  failedElements,
  improvedElements,
  tallyAnswer,
  toAnswerInput,
  type AnswerEvaluation,
  type AnswerResponse,
  type SessionTally,
  type SummaryInput,
  type TallyEntry,
} from './session-tally';
export { SessionSummary, type SessionSummaryProps } from './SessionSummary';
export { SummaryAchievements } from './SummaryAchievements';
export { ImprovedList, ReviewList } from './SummaryElements';
export { SummaryScore } from './SummaryScore';
export { describeTableReview, reviewTableAnswer, type TableReview } from './table-review';
export { TableQuestion, type TableQuestionProps } from './TableQuestion';
export {
  useAnswerFeedback,
  useAnswerRecorder,
  type AnswerRecorder,
  type RecordedAnswer,
  type SubmitOptions,
} from './use-answer-recorder';
export { isActivationTarget, optionIndexFromKey, useQuizKeys } from './use-quiz-keys';
