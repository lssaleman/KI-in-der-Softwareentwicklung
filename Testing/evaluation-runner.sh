
#!/usr/bin/env bash

set -Eeuo pipefail

# ==========================================
# Configuration
# ==========================================

# Directory containing this script and prompt files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Project root is one directory above SCRIPT_DIR
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GENERIC_BRANCH="evaluation-runner"
STARTPAGE_BRANCH="test-with-startpage"

RESULTS_FILE="$SCRIPT_DIR/results.tsv"
LOG_DIR="$SCRIPT_DIR/eval-logs"

# Initial Git checkpoint
CHECKPOINT="$(git -C "$PROJECT_DIR" rev-parse HEAD)"

# Prompt files (same directory as this script)
PROMPTS=(
    "$SCRIPT_DIR/startseite.prompt.txt"
    "$SCRIPT_DIR/prompt-2.txt"
    "$SCRIPT_DIR/prompt-3.txt"
    "$SCRIPT_DIR/prompt-4.txt"
    "$SCRIPT_DIR/prompt-5.txt"
    "$SCRIPT_DIR/prompt-6.txt"
    "$SCRIPT_DIR/prompt-7.txt"
    "$SCRIPT_DIR/prompt-8.txt"
)

# ==========================================
# Automatic checks
# ==========================================

run_automatic_checks() {
    local run_number="$1"

    # TODO: Add automatic checks here.
    # Return 0 if all checks pass.
    # Return non-zero if a check fails.

    echo "Running automatic checks for run $run_number..."

    # Examples:
    # npm test
    # npm run lint
    # npm run build

    return 0
}

# ==========================================
# Initialization
# ==========================================

mkdir -p "$LOG_DIR"

echo -e "Run\tBranch\tExecution\tChecks\tResult" > "$RESULTS_FILE"

echo "Project directory: $PROJECT_DIR"
echo "Script directory:  $SCRIPT_DIR"
echo "Initial checkpoint: $CHECKPOINT"

# Ensure working tree starts clean
if ! git -C "$PROJECT_DIR" diff --quiet ||
   ! git -C "$PROJECT_DIR" diff --cached --quiet; then
    echo "ERROR: Git working tree is not clean."
    exit 1
fi

# ==========================================
# Helper functions
# ==========================================

get_current_branch() {
    git -C "$PROJECT_DIR" branch --show-current
}

check_branch() {
    local expected="$1"
    local actual

    actual="$(get_current_branch)"

    if [[ "$actual" != "$expected" ]]; then
        echo "ERROR: Wrong Git branch!"
        echo "Expected: $expected"
        echo "Actual:   $actual"
        return 1
    fi

    echo "Git branch verified: $actual"
}

write_result() {
    local run="$1"
    local branch="$2"
    local execution="$3"
    local checks="$4"
    local result="$5"

    printf "%s\t%s\t%s\t%s\t%s\n" \
        "$run" "$branch" "$execution" "$checks" "$result" \
        >> "$RESULTS_FILE"
}

# ==========================================
# Main evaluation loop
# ==========================================

for i in {1..8}; do

    echo ""
    echo "=========================================="
    echo "Starting evaluation run $i / 8"
    echo "=========================================="

    # Determine required branch
    if [[ "$i" -le 7 ]]; then
        EXPECTED_BRANCH="$GENERIC_BRANCH"
    else
        EXPECTED_BRANCH="$STARTPAGE_BRANCH"
    fi

    # Run 8 switches to its dedicated branch
    if [[ "$i" -eq 8 ]]; then
        echo "Switching to $STARTPAGE_BRANCH..."

        git -C "$PROJECT_DIR" switch "$STARTPAGE_BRANCH"
    fi

    # Verify branch before every run
    if ! check_branch "$EXPECTED_BRANCH"; then
        write_result "$i" "$EXPECTED_BRANCH" "SKIPPED" "SKIPPED" "FAILED"
        exit 1
    fi

    PROMPT_FILE="${PROMPTS[$((i-1))]}"
    LOG_FILE="$LOG_DIR/run-$i.log"

    # Verify prompt file
    if [[ ! -f "$PROMPT_FILE" ]]; then
        echo "ERROR: Prompt file not found: $PROMPT_FILE"
        write_result "$i" "$EXPECTED_BRANCH" "SKIPPED" "SKIPPED" "FAILED"
        exit 1
    fi

    # ======================================
    # Execute OpenCode in project root
    # ======================================

    echo "Executing OpenCode run $i..."

    if (
        cd "$PROJECT_DIR"
        opencode run "$(cat "$PROMPT_FILE")"
    ) > "$LOG_FILE" 2>&1; then
        EXECUTION_STATUS="SUCCESS"
    else
        EXECUTION_STATUS="FAILED"
    fi

    # ======================================
    # Automatic checks in project root
    # ======================================

    if [[ "$EXECUTION_STATUS" == "SUCCESS" ]]; then

        if (
            cd "$PROJECT_DIR"
            run_automatic_checks "$i"
        ); then
            CHECK_STATUS="SUCCESS"
        else
            CHECK_STATUS="FAILED"
        fi

    else
        CHECK_STATUS="NOT_EXECUTED"
    fi

    # ======================================
    # Evaluate result
    # ======================================

    if [[ "$EXECUTION_STATUS" == "SUCCESS" &&
          "$CHECK_STATUS" == "SUCCESS" ]]; then

        RESULT="SUCCESS"

    else
        RESULT="FAILED"
    fi

    write_result \
        "$i" \
        "$EXPECTED_BRANCH" \
        "$EXECUTION_STATUS" \
        "$CHECK_STATUS" \
        "$RESULT"

    echo "Run $i result: $RESULT"

    # ======================================
    # Reset checkpoint after runs 1-7
    # ======================================

    if [[ "$i" -le 7 ]]; then

        if [[ "$RESULT" == "SUCCESS" ]]; then

            echo "Resetting Git to initial checkpoint..."

            git -C "$PROJECT_DIR" reset --hard "$CHECKPOINT"

        else
            echo "Run failed. Stopping evaluation."
            echo "Checkpoint preserved: $CHECKPOINT"
            exit 1
        fi

    else
        echo "Run 8 completed. No checkpoint reset."
    fi

done

# ==========================================
# Final summary
# ==========================================

echo ""
echo "=========================================="
echo "Evaluation completed"
echo "=========================================="

if command -v column >/dev/null 2>&1; then
    column -t -s $'\t' "$RESULTS_FILE"
else
    cat "$RESULTS_FILE"
fi

echo ""
echo "Results: $RESULTS_FILE"
echo "Logs:    $LOG_DIR"
