-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `displayName` VARCHAR(100) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `subscriptionStatus` VARCHAR(20) NOT NULL DEFAULT 'free',
    `isAdmin` BOOLEAN NOT NULL DEFAULT false,
    `onboardingComplete` BOOLEAN NOT NULL DEFAULT false,
    `referralSource` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,

    UNIQUE INDEX `accounts_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_sessionToken_key`(`sessionToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_tokens` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `verification_tokens_token_key`(`token`),
    UNIQUE INDEX `verification_tokens_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_preferences` (
    `userId` CHAR(36) NOT NULL,
    `locationKey` VARCHAR(64) NOT NULL DEFAULT 'los-angeles-ca',
    `timeFormat` VARCHAR(3) NOT NULL DEFAULT '12h',
    `showHebrewDates` BOOLEAN NOT NULL DEFAULT true,
    `weekStartsOn` INTEGER NOT NULL DEFAULT 0,
    `defaultView` VARCHAR(10) NOT NULL DEFAULT 'week',
    `showParsha` BOOLEAN NOT NULL DEFAULT true,
    `showRoshChodesh` BOOLEAN NOT NULL DEFAULT true,
    `showOmer` BOOLEAN NOT NULL DEFAULT true,
    `showModernHolidays` BOOLEAN NOT NULL DEFAULT false,
    `showOutsideMonthDays` BOOLEAN NOT NULL DEFAULT true,
    `havdalahOpinion` VARCHAR(20) NOT NULL DEFAULT 'tzeit-8_5',
    `havdalahMode` VARCHAR(20) NOT NULL DEFAULT 'nusach',
    `nusach` VARCHAR(20) NOT NULL DEFAULT 'ashkenaz',
    `observanceLevel` VARCHAR(20) NOT NULL DEFAULT 'unknown',
    `timelineSnapMins` INTEGER NOT NULL DEFAULT 15,
    `timelineDefaultDurationMins` INTEGER NOT NULL DEFAULT 30,
    `showHebrewDatesOnGoals` BOOLEAN NOT NULL DEFAULT false,
    `hebrewDateFormat` VARCHAR(10) NOT NULL DEFAULT 'english',
    `hebrewDateIncludeYear` BOOLEAN NOT NULL DEFAULT false,
    `hebrewMode` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_presets` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `emoji` VARCHAR(8) NULL,
    `cadence` VARCHAR(20) NOT NULL,
    `measure` VARCHAR(10) NOT NULL,
    `failureMode` VARCHAR(20) NOT NULL,
    `dayModel` VARCHAR(10) NULL,
    `startsAtDefault` VARCHAR(100) NULL,
    `expiresAtDefault` VARCHAR(100) NULL,
    `targetDefault` INTEGER NULL,
    `targetUnitDefault` VARCHAR(100) NULL,
    `exclusionsDefault` JSON NULL,
    `activeDaysDefault` JSON NULL,
    `seasonalRule` JSON NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `goal_presets_slug_key`(`slug`),
    INDEX `goal_presets_isPublished_sortOrder_idx`(`isPublished`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hebcal_day_cache` (
    `id` CHAR(36) NOT NULL,
    `locationKey` VARCHAR(64) NOT NULL,
    `gregorianDate` DATE NOT NULL,
    `hebrewYear` INTEGER NOT NULL,
    `hebrewMonth` INTEGER NOT NULL,
    `hebrewDay` INTEGER NOT NULL,
    `hebrewDateStr` VARCHAR(40) NOT NULL,
    `isShabbat` BOOLEAN NOT NULL DEFAULT false,
    `isYomTov` BOOLEAN NOT NULL DEFAULT false,
    `isCholHamoed` BOOLEAN NOT NULL DEFAULT false,
    `isRoshChodesh` BOOLEAN NOT NULL DEFAULT false,
    `isFastDay` BOOLEAN NOT NULL DEFAULT false,
    `parsha` VARCHAR(80) NULL,
    `omerDay` INTEGER NULL,
    `payload` JSON NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `hebcal_day_cache_gregorianDate_idx`(`gregorianDate`),
    INDEX `hebcal_day_cache_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `hebcal_day_cache_locationKey_gregorianDate_key`(`locationKey`, `gregorianDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goals` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `parentGoalId` CHAR(36) NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `emoji` VARCHAR(8) NULL,
    `cadence` VARCHAR(20) NOT NULL,
    `measure` VARCHAR(10) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ongoing',
    `source` VARCHAR(20) NOT NULL DEFAULT 'custom',
    `presetId` CHAR(36) NULL,
    `dayModel` VARCHAR(10) NULL,
    `target` INTEGER NULL,
    `targetUnit` VARCHAR(100) NULL,
    `totalTarget` INTEGER NULL,
    `failureMode` VARCHAR(20) NOT NULL DEFAULT 'forgiving',
    `carryover` VARCHAR(20) NOT NULL DEFAULT 'drop',
    `noGettingAhead` BOOLEAN NOT NULL DEFAULT false,
    `startsAt` VARCHAR(100) NULL,
    `expiresAt` VARCHAR(100) NULL,
    `preferredMonthDay` VARCHAR(10) NULL,
    `lockInDays` BOOLEAN NOT NULL DEFAULT false,
    `startDate` DATE NULL,
    `endDate` DATE NULL,
    `dueDate` DATE NULL,
    `endAfterPeriods` INTEGER NULL,
    `programKey` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `pausedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `goals_userId_cadence_deletedAt_idx`(`userId`, `cadence`, `deletedAt`),
    INDEX `goals_userId_status_idx`(`userId`, `status`),
    INDEX `goals_presetId_idx`(`presetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_active_days` (
    `goalId` CHAR(36) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,

    PRIMARY KEY (`goalId`, `dayOfWeek`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_exclusions` (
    `goalId` CHAR(36) NOT NULL,
    `holidayKey` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`goalId`, `holidayKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_milestones` (
    `id` CHAR(36) NOT NULL,
    `goalId` CHAR(36) NOT NULL,
    `label` VARCHAR(500) NOT NULL,
    `markerAmount` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `goal_milestones_goalId_idx`(`goalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_periods` (
    `id` CHAR(36) NOT NULL,
    `goalId` CHAR(36) NOT NULL,
    `periodKey` VARCHAR(20) NOT NULL,
    `targetAmount` INTEGER NOT NULL,
    `plannedAmount` INTEGER NOT NULL DEFAULT 0,
    `completedAmount` INTEGER NOT NULL DEFAULT 0,
    `backlogIn` INTEGER NOT NULL DEFAULT 0,
    `backlogOut` INTEGER NOT NULL DEFAULT 0,
    `periodEndedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `goal_periods_goalId_periodKey_key`(`goalId`, `periodKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_status_history` (
    `id` CHAR(36) NOT NULL,
    `goalId` CHAR(36) NOT NULL,
    `fromStatus` VARCHAR(20) NULL,
    `toStatus` VARCHAR(20) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` TEXT NULL,

    INDEX `goal_status_history_goalId_idx`(`goalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `id` CHAR(36) NOT NULL,
    `goalId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `occurrenceDate` DATE NULL,
    `hebrewYear` INTEGER NULL,
    `hebrewMonth` INTEGER NULL,
    `hebrewDay` INTEGER NULL,
    `seasonalIndex` INTEGER NULL,
    `periodKey` VARCHAR(20) NULL,
    `windowStart` DATETIME(3) NULL,
    `windowEnd` DATETIME(3) NULL,
    `targetAmount` INTEGER NULL,
    `scheduledTime` VARCHAR(5) NULL,
    `durationMins` INTEGER NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `actualAmount` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'planned',
    `materializedReason` VARCHAR(30) NULL,
    `originalDate` DATE NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `assignments_userId_date_idx`(`userId`, `date`),
    INDEX `assignments_userId_hebrewYear_hebrewMonth_hebrewDay_idx`(`userId`, `hebrewYear`, `hebrewMonth`, `hebrewDay`),
    INDEX `assignments_goalId_status_idx`(`goalId`, `status`),
    INDEX `assignments_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `assignments_goalId_date_key`(`goalId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_suppression` (
    `id` CHAR(36) NOT NULL,
    `goalId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `reason` VARCHAR(30) NOT NULL,
    `relatedAssignmentId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `goal_suppression_userId_date_idx`(`userId`, `date`),
    UNIQUE INDEX `goal_suppression_goalId_date_deletedAt_key`(`goalId`, `date`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_feeders` (
    `id` CHAR(36) NOT NULL,
    `projectGoalId` CHAR(36) NOT NULL,
    `feederGoalId` CHAR(36) NOT NULL,
    `weight` DECIMAL(10, 4) NOT NULL DEFAULT 1.0000,
    `autoRollup` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `project_feeders_feederGoalId_idx`(`feederGoalId`),
    UNIQUE INDEX `project_feeders_projectGoalId_feederGoalId_key`(`projectGoalId`, `feederGoalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_progress` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `projectGoalId` CHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `occurredOn` DATE NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `sourceAssignmentId` CHAR(36) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `project_progress_projectGoalId_occurredOn_idx`(`projectGoalId`, `occurredOn`),
    INDEX `project_progress_userId_projectGoalId_idx`(`userId`, `projectGoalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_goal_order` (
    `userId` CHAR(36) NOT NULL,
    `goalId` CHAR(36) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `user_goal_order_userId_sortOrder_idx`(`userId`, `sortOrder`),
    PRIMARY KEY (`userId`, `goalId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_events` (
    `id` CHAR(36) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `userEmail` VARCHAR(320) NULL,
    `details` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` CHAR(36) NULL,

    INDEX `admin_events_createdAt_idx`(`createdAt`),
    INDEX `admin_events_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goals` ADD CONSTRAINT `goals_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goals` ADD CONSTRAINT `goals_parentGoalId_fkey` FOREIGN KEY (`parentGoalId`) REFERENCES `goals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goals` ADD CONSTRAINT `goals_presetId_fkey` FOREIGN KEY (`presetId`) REFERENCES `goal_presets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_active_days` ADD CONSTRAINT `goal_active_days_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_exclusions` ADD CONSTRAINT `goal_exclusions_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_milestones` ADD CONSTRAINT `goal_milestones_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_periods` ADD CONSTRAINT `goal_periods_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_status_history` ADD CONSTRAINT `goal_status_history_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_feeders` ADD CONSTRAINT `project_feeders_projectGoalId_fkey` FOREIGN KEY (`projectGoalId`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_feeders` ADD CONSTRAINT `project_feeders_feederGoalId_fkey` FOREIGN KEY (`feederGoalId`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_events` ADD CONSTRAINT `admin_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
