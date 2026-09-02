export enum Severity {
  NoIssue = "No issue",
  Minor = "Minor",
  Major = "Major",
}

export enum Seated {
  StandingMoving = "Standing/ Moving",
  AllowSeated = "Allow Seated",
  Seated = "Seated",
}

export enum Environment {
  CorrectTask = "Correct Task",
  WrongTask = "Wrong Task",
}

export type Other = Severity | "Unavailable" | "Processing";

export enum SystemRating {
  Great = "Great",
  Good = "Good",
  NeedsWork = "Needs work",
  None = "", // internal value is empty
}

export interface SessionRow {
  email: string;
  task: string;
  minutes: string;
  recordedTimestamp: string;
  uploadedTimestamp: string;
  sessionId: string;
  link: string;
  ratings?: Ratings;
  systemRating: string;
}

export type Ratings = {
  lighting: Severity | "";
  sharpness: Severity | "";
  handVisibility: Severity | "";
  fovFraming: Severity | "";
  cameraAngle: Severity | "";
  idle: Severity | "";
  seated: Seated | "";
  environment: Environment | "";
  other: Other | "";
  comment?: string;
  slowLoading?: boolean;
  crosscheckComment?: string;
};

export type SeverityFieldKey = Exclude<
  keyof Ratings,
  | "seated"
  | "environment"
  | "other"
  | "comment"
  | "slowLoading"
  | "crosscheckComment"
  | "systemRating"
>;

export interface SeverityFieldDef {
  key: SeverityFieldKey;
  label: string;
}
