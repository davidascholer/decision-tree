# Planning Guide

A visual tool for creating, editing, and visualizing complex decision trees with nested logic flows, allowing users to map out decision-making processes using standard flowchart symbols.

**Experience Qualities**: 
1. **Structured** - Clear hierarchical organization makes complex decision logic easy to understand and navigate
2. **Visual** - Dual-mode interface with both editing and flowchart visualization provides immediate visual feedback
3. **Flexible** - Unlimited nesting and branching allows modeling of any decision complexity

**Complexity Level**: Light Application (multiple features with basic state)
This is a focused decision tree editor with CRUD operations, nested data structures, and dual viewing modes (editor + visualization), but doesn't require authentication, external APIs, or advanced state management beyond local persistence.

## Essential Features

### Create Decision Tree
- **Functionality**: Users can create new decision tree paths with unique names
- **Purpose**: Establishes the top-level entry points for decision logic
- **Trigger**: Click "New Path" button
- **Progression**: Click button → Enter path name → Path appears in editor list → Auto-selected for editing
- **Success criteria**: New path appears in list, is persisted to storage, and can be edited immediately

### Add Decision Nodes
- **Functionality**: Add decision points (diamond shapes) within a tree that contain a question and multiple branches
- **Purpose**: Create branching logic where different conditions lead to different outcomes
- **Trigger**: Click "Add Decision" button within a path or nested decision
- **Progression**: Click button → Enter question text → Decision node created → Can add branches/outcomes
- **Success criteria**: Decision appears in accordion, shows in flowchart as diamond, can be nested unlimited levels deep

### Reference Existing Paths
- **Functionality**: Link to another path by ID instead of duplicating logic
- **Purpose**: Reuse decision logic across multiple paths, avoiding duplication
- **Trigger**: Select "Path Reference" option when adding a branch
- **Progression**: Select path reference → Choose from dropdown of available paths → Reference created with distinct styling
- **Success criteria**: Path reference appears in tree, visualizes as connector in flowchart, maintains reference relationship in JSON

### Define Outcomes
- **Functionality**: Create terminal nodes (rounded rectangles) that represent final results
- **Purpose**: Define end states of decision paths
- **Trigger**: Select "Outcome" option when adding a branch
- **Progression**: Select outcome → Enter outcome description → Outcome node created
- **Success criteria**: Outcome appears as leaf node in accordion, renders as rounded rectangle in flowchart

### Visualize as Flowchart
- **Functionality**: Render the decision tree as a standard flowchart with proper symbols
- **Purpose**: Provide familiar visual representation for understanding logic flow
- **Trigger**: Switch to "Flowchart View" tab
- **Progression**: Click tab → Tree is traversed → SVG flowchart rendered with proper symbols and connectors
- **Success criteria**: All nodes render with correct symbols (diamond for decisions, rounded rectangle for outcomes, rectangle for paths), connectors show flow direction

### Edit & Delete Nodes
- **Functionality**: Modify text of any node or remove nodes from the tree
- **Purpose**: Iterate on decision logic and fix mistakes
- **Trigger**: Click edit/delete icons on any node
- **Progression**: Click edit → Modify text inline → Save → Or click delete → Confirm → Node removed
- **Success criteria**: Changes persist to storage, visualization updates immediately, deleting a node removes all children

### Export Decision Trees as JSON
- **Functionality**: Download all decision trees as a formatted JSON file
- **Purpose**: Enable sharing with team members and backing up decision logic
- **Trigger**: Click "Export" button in header
- **Progression**: Click export → JSON file downloads with timestamp → Toast confirms success
- **Success criteria**: File contains complete tree structure with all nodes and relationships, formatted for readability

### Import Decision Trees from JSON
- **Functionality**: Load decision trees from a JSON file
- **Purpose**: Restore backed up trees or import trees shared by team members
- **Trigger**: Click "Import" button in header
- **Progression**: Click import → Select JSON file → Trees loaded → Toast shows count → First tree auto-selected
- **Success criteria**: All valid trees are imported, invalid files show clear error message, imported trees persist to storage

## Edge Case Handling
- **Empty State**: Shows helpful prompt to create first path when no trees exist
- **Circular References**: Prevents selecting a path as a reference if it would create a circular dependency
- **Deep Nesting**: Accordion collapses deeply nested decisions by default, expandable on demand
- **Long Text**: Decision questions and outcomes truncate with ellipsis in compact views
- **Delete Confirmation**: Warns when deleting nodes with children that all nested content will be lost
- **Invalid JSON Import**: Shows clear error message when imported file is not valid JSON or doesn't match expected structure
- **Empty JSON Export**: Export button is disabled when no decision trees exist
- **Import Overwrites**: Imported trees replace all existing trees (user should export first to backup)

## Design Direction
The design should feel technical and structured like a professional diagramming tool, while remaining approachable and modern. It should evoke the precision of technical documentation with clean lines, clear hierarchy, and purposeful use of color to distinguish different node types.

## Color Selection
A cool, technical color scheme with blues and grays that feels analytical and precise, with accent colors to distinguish node types.

- **Primary Color**: Deep blue `oklch(0.45 0.15 250)` - Represents structure and logic, used for primary actions and headers
- **Secondary Colors**: 
  - Cool gray `oklch(0.60 0.02 250)` for secondary UI elements
  - Light blue-gray `oklch(0.95 0.01 250)` for backgrounds
- **Accent Color**: Vibrant cyan `oklch(0.65 0.18 210)` for interactive elements and highlights
- **Node Type Colors**:
  - Decision nodes: Amber `oklch(0.70 0.15 70)` for questions/branches
  - Outcome nodes: Green `oklch(0.65 0.15 145)` for terminal states
  - Path reference nodes: Purple `oklch(0.60 0.15 290)` for references
- **Foreground/Background Pairings**: 
  - Primary (Deep Blue): White text `oklch(0.98 0 0)` - Ratio 7.8:1 ✓
  - Accent (Cyan): Dark blue text `oklch(0.25 0.05 250)` - Ratio 5.2:1 ✓
  - Decision (Amber): Dark brown text `oklch(0.25 0.05 70)` - Ratio 6.1:1 ✓
  - Outcome (Green): Dark green text `oklch(0.25 0.08 145)` - Ratio 6.4:1 ✓

## Font Selection
Use a clean, technical sans-serif that conveys precision and clarity, paired with a monospace font for IDs and technical details.

- **Typographic Hierarchy**: 
  - H1 (App Title): Space Grotesk Bold/32px/tight letter-spacing
  - H2 (Section Headers): Space Grotesk Semibold/24px/normal spacing
  - H3 (Path Names): Space Grotesk Medium/20px/normal spacing
  - Body (Decision Text): Inter Regular/16px/relaxed line-height
  - Code (IDs/References): JetBrains Mono Regular/14px/normal spacing

## Animations
Animations should reinforce the hierarchical structure and flow of logic. Use purposeful motion to guide attention through the decision tree.

- Accordion expand/collapse with smooth easing to show nested structure revealing
- Flowchart nodes fade in sequentially to illustrate flow direction from start to finish
- Hover states on nodes with subtle scale and glow to indicate interactivity
- Drag handles pulse gently to indicate reorder capability
- Add/delete actions with smooth transitions to maintain spatial awareness

## Component Selection
- **Components**: 
  - Accordion (decision tree editor) - customize with node type indicators and action buttons
  - Tabs (switch between editor/flowchart views) - full-width with clear visual distinction
  - Button (all actions) - variants for primary, secondary, and destructive actions
  - Dialog (add/edit nodes) - for focused input without losing context
  - Select (path references) - dropdown for choosing existing paths
  - Card (individual paths) - contain each top-level path with subtle elevation
  - Badge (node type indicators) - color-coded by node type
  - Separator (between sections) - subtle dividers for visual organization
- **Customizations**: 
  - Custom SVG flowchart renderer with D3 for proper flowchart symbols
  - Custom node components with type-specific icons and colors
  - Custom accordion items with drag handles and inline actions
- **States**: 
  - Buttons: Solid primary with slight darken on hover, pressed state with scale
  - Accordion items: Subtle background on hover, highlighted when expanded
  - Flowchart nodes: Glow effect on hover, selected state with border emphasis
  - Empty states: Centered with illustration and clear CTA button
- **Icon Selection**: 
  - Plus for add actions
  - Trash for delete
  - Pencil for edit
  - FlowArrow for path references
  - DiamondsFour for decisions
  - CheckCircle for outcomes
  - Tree for flowchart view
  - List for editor view
- **Spacing**: 
  - Container padding: p-6
  - Card padding: p-4
  - Section gaps: gap-6
  - Button groups: gap-3
  - Accordion items: gap-2
  - Inline elements: gap-2
- **Mobile**: 
  - Tabs become full-width stacked buttons
  - Accordion items increase touch targets to 48px minimum
  - Flowchart becomes horizontally scrollable with pinch-zoom
  - Side-by-side layouts stack vertically
  - Bottom action bar for primary actions on small screens
