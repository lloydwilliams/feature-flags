package com.example.samplejavaapi.userprofile;

/**
 * The organization a user belongs to.
 *
 * <p>Shaped for Datadog RUM's {@code setAccount}: {@code id} is required there, and the remaining
 * fields arrive as {@code account.*} attributes.
 */
public record Account(String id, String name, String plan) {}
