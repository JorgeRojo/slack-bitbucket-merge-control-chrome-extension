#!/bin/bash

# Script to create a new bug report based on the template

# Set the bugs directory path
BUGS_DIR="./documentation/bugs"
INDEX_FILE="$BUGS_DIR/README.md"

# Check if the bugs directory exists
if [ ! -d "$BUGS_DIR" ]; then
  echo "Error: Bugs directory not found at $BUGS_DIR"
  exit 1
fi

# Find the next available bug ID
get_next_bug_id() {
  local max_id=0
  for file in "$BUGS_DIR"/*-*.md; do
    if [ -f "$file" ]; then
      # Extract the numeric ID from the filename
      filename=$(basename "$file")
      id=$(echo "$filename" | grep -o '^[0-9]\+')
      if [[ "$id" =~ ^[0-9]+$ ]] && [ "$id" -gt "$max_id" ]; then
        max_id=$id
      fi
    fi
  done
  # Return the next ID (current max + 1)
  echo $((max_id + 1))
}

# Format the bug ID with leading zeros
format_bug_id() {
  printf "%03d" "$1"
}

# Get the next bug ID
next_id=$(get_next_bug_id)
formatted_id=$(format_bug_id $next_id)

echo "Creating new bug report with ID: $formatted_id"

# Prompt for bug details
read -p "Bug title: " bug_title
read -p "Component (file/module affected): " component
read -p "Status [Open/Fixed/Won't Fix]: " status
read -p "Severity [Critical/High/Medium/Low]: " severity
read -p "Steps to reproduce (use ; for line breaks): " reproduce_steps
read -p "Current wrong behavior: " wrong_behavior
read -p "Expected right behavior: " right_behavior
read -p "Root cause (if known): " root_cause
read -p "Fix summary (if applicable): " fix_summary
read -p "Tests added/modified (if applicable): " tests_added
read -p "Related files (comma separated): " related_files

# Format the date
current_date=$(date +"%Y-%m-%d")

# Convert reproduce steps to multiple lines
formatted_reproduce=$(echo "$reproduce_steps" | sed 's/;/\n/g' | sed 's/^/- /')

# Format related files as a list
formatted_related_files=""
IFS=',' read -ra FILES <<< "$related_files"
for file in "${FILES[@]}"; do
  formatted_related_files+="- \`${file// /}\`\n"
done

# Create a slug from the title
slug=$(echo "$bug_title" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:] ' | tr ' ' '-')

# Create the bug file
bug_file="$BUGS_DIR/${formatted_id}-${slug}.md"

cat > "$bug_file" << EOF
# Bug ${formatted_id}: ${bug_title}

## Component
\`${component}\`

## Date Reported
${current_date}

## Status
${status}

## Severity
${severity}

## Reproduce
${formatted_reproduce}

## Current wrong behavior
${wrong_behavior}

## Expected right behavior
${right_behavior}

## Root Cause
${root_cause}

## Fix Summary
${fix_summary}

## Tests Added/Modified
${tests_added}

## Related Files
${formatted_related_files}
EOF

echo "Bug report created at: $bug_file"

# Now update the index file
# First, extract the table from the README
table_start_line=$(grep -n "| ID | Title | Component | Status | Severity | Date Reported | Date Fixed |" "$INDEX_FILE" | cut -d: -f1)
table_end_line=$(grep -n "## How to Add a New Bug" "$INDEX_FILE" | cut -d: -f1)
table_end_line=$((table_end_line - 1))

# Create a temporary file for the new content
temp_file=$(mktemp)

# Copy the content before the table
head -n $table_start_line "$INDEX_FILE" > "$temp_file"

# Add the table header
echo "| ID | Title | Component | Status | Severity | Date Reported | Date Fixed |" >> "$temp_file"
echo "|----|-------|-----------|--------|----------|--------------|------------|" >> "$temp_file"

# Add the new bug entry
echo "| [${formatted_id}](./${formatted_id}-${slug}.md) | ${bug_title} | ${component} | ${status} | ${severity} | ${current_date} | ${status == "Fixed" ? current_date : ""} |" >> "$temp_file"

# Add existing entries (excluding the header rows)
sed -n "$((table_start_line + 2)),$table_end_line p" "$INDEX_FILE" >> "$temp_file"

# Add the content after the table
sed -n "$((table_end_line + 1)),\$ p" "$INDEX_FILE" >> "$temp_file"

# Replace the original file
mv "$temp_file" "$INDEX_FILE"

echo "Bug index updated successfully!"
echo "Don't forget to commit the changes:"
echo "git add $bug_file $INDEX_FILE"
echo "git commit -m \"Add bug report #${formatted_id}: ${bug_title}\""
echo "git push origin master"
