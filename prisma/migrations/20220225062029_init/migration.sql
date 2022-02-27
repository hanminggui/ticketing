-- CreateTable
CREATE TABLE `airport` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(63) NOT NULL,

    UNIQUE INDEX `airport_name_uindex`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flight` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `capacity` TINYINT UNSIGNED NOT NULL,
    `route_id` INTEGER UNSIGNED NOT NULL,
    `base_price` DECIMAL(10, 2) NOT NULL,

    INDEX `flight_route_id_index`(`route_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `from_airport_id` INTEGER UNSIGNED NOT NULL,
    `to_airport_id` INTEGER UNSIGNED NOT NULL,

    INDEX `route_from_airport_id_index`(`from_airport_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `flight_id` INTEGER UNSIGNED NOT NULL,
    `traveler_id` INTEGER UNSIGNED NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `uuid` VARCHAR(32) NOT NULL,

    UNIQUE INDEX `ticket_uuid_uindex`(`uuid`),
    INDEX `ticket_flight_id_index`(`flight_id`),
    INDEX `ticket_traveler_id_index`(`traveler_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `traveler` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(32) NOT NULL,
    `route_id` INTEGER UNSIGNED NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
