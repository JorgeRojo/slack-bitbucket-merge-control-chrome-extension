# Product Overview

## Project Purpose

Slack-Bitbucket Merge Control is a Chrome extension that bridges Slack communication with Bitbucket pull request management. It monitors specified Slack channels for messages containing merge control keywords and dynamically enables/disables merge buttons on Bitbucket pull request pages based on those messages.

## Value Proposition

- **Real-time Integration**: Connects team communication in Slack directly to code deployment controls in Bitbucket
- **Automated Merge Control**: Eliminates manual coordination between team discussions and merge decisions
- **Enhanced Team Coordination**: Provides visibility into merge status and the reasoning behind merge control decisions
- **Risk Mitigation**: Prevents accidental merges during critical discussions or deployment freezes

## Key Features

### Core Functionality

- **Slack Channel Monitoring**: Reads messages from configurable public and private Slack channels
- **Real-time Updates**: Uses Slack Socket Mode for instant message processing
- **Bitbucket Integration**: Controls merge button availability on pull request pages
- **Status Visibility**: Extension popup displays current merge status and latest relevant message

### Technical Capabilities

- **TypeScript Implementation**: Full type safety and enhanced development experience
- **Web Components Architecture**: Custom elements for reusable UI components
- **Chrome Extension APIs**: Native browser integration with background scripts and content scripts
- **Comprehensive Testing**: High test coverage with Vitest framework
- **Modern Build System**: Vite-powered bundling with development and production modes

### User Interface

- **Extension Popup**: Shows current merge status and latest matching message
- **Options Page**: Configuration interface for Slack app settings and channel selection
- **Help Documentation**: Built-in comprehensive setup and usage instructions
- **Visual Status Indicators**: Icon states reflect current merge control status

## Target Users

### Primary Users

- **Development Teams**: Teams using Slack for communication and Bitbucket for code management
- **DevOps Engineers**: Managing deployment coordination and merge controls
- **Team Leads**: Overseeing code review and merge processes

### Use Cases

- **Deployment Coordination**: Prevent merges during deployment windows or maintenance
- **Emergency Response**: Quick merge freezes during incident response
- **Release Management**: Coordinate merge timing with release schedules
- **Team Communication**: Bridge gap between discussion and action in development workflow

## Business Impact

- **Reduced Deployment Risks**: Prevents uncoordinated merges during critical periods
- **Improved Team Efficiency**: Eliminates manual merge coordination overhead
- **Enhanced Visibility**: Clear status communication across development workflow
- **Process Automation**: Streamlines merge control without additional tooling complexity
