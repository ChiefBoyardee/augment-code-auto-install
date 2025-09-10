# Augment Monitor Windows Scheduled Task Installation Script
# This script sets up automatic monitoring for Augment extension updates using Windows Task Scheduler

param(
    [string]$Schedule = "Every6Hours",
    [switch]$Force,
    [switch]$WhatIf
)

# Configuration
$TaskName = "AugmentMonitor"
$TaskDescription = "Automated monitor and updater for Augment VS Code extension in Cursor"
$ScriptDir = $PSScriptRoot
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
$LogsDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogsDir "task.log"

# Schedule options
$Schedules = @{
    "Every6Hours" = @{
        StartTime = "12:00"
        Description = "Every 6 hours (simplified - runs daily at noon)"
    }
    "WorkHours" = @{
        StartTime = "09:00"
        DaysOfWeek = @("Monday", "Tuesday", "Wednesday", "Thursday", "Friday")
        Description = "Daily during work days at 9 AM"
    }
    "Daily" = @{
        StartTime = "09:00"
        Description = "Daily at 9 AM"
    }
    "Every3Hours" = @{
        StartTime = "12:00"
        Description = "Every 3 hours (simplified - runs daily at noon)"
    }
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Test-Administrator {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-Elevation {
    if ($WhatIf) {
        Write-ColorOutput "WHAT-IF: Would request elevation to Administrator privileges" "Magenta"
        return
    }
    
    Write-ColorOutput "Requesting Administrator privileges..." "Yellow"
    Write-ColorOutput "Please click 'Yes' on the UAC prompt to continue." "Gray"
    
    # Get the current script path and build arguments
    $scriptPath = $PSCommandPath
    $argList = @("-ExecutionPolicy", "Bypass", "-File", "`"$scriptPath`"")
    
    # Add original parameters
    if ($Schedule -ne "Every6Hours") { $argList += @("-Schedule", $Schedule) }
    if ($Force) { $argList += "-Force" }
    
    try {
        Start-Process powershell -ArgumentList $argList -Verb RunAs -Wait
        exit 0
    } catch {
        Write-ColorOutput "Failed to elevate privileges: $($_.Exception.Message)" "Red"
        Write-ColorOutput "Please run PowerShell as Administrator manually." "Yellow"
        exit 1
    }
}

function Test-Prerequisites {
    Write-ColorOutput "Checking prerequisites..." "Cyan"
    
    # Check if running as Administrator
    if (-not (Test-Administrator)) {
        if ($WhatIf) {
            Write-ColorOutput "Not running as Administrator (WhatIf mode - continuing anyway)" "Yellow"
        } else {
            Write-ColorOutput "Administrator privileges required for creating scheduled tasks." "Yellow"
            Request-Elevation
            return
        }
    } else {
        Write-ColorOutput "Running with Administrator privileges" "Green"
    }
    
    # Check if Node.js is available
    if (-not $NodePath) {
        Write-ColorOutput "Error: Node.js not found in PATH." "Red"
        Write-ColorOutput "Please install Node.js first: https://nodejs.org/" "Yellow"
        exit 1
    }
    
    # Check if the main script exists
    $IndexPath = Join-Path $ScriptDir "index.js"
    if (-not (Test-Path $IndexPath)) {
        Write-ColorOutput "Error: index.js not found in $ScriptDir" "Red"
        exit 1
    }
    
    # Check if package.json exists (verify it's the right directory)
    $PackagePath = Join-Path $ScriptDir "package.json"
    if (-not (Test-Path $PackagePath)) {
        Write-ColorOutput "Error: package.json not found. Are you in the correct directory?" "Red"
        exit 1
    }
    
    Write-ColorOutput "Prerequisites check passed" "Green"
    Write-ColorOutput "Node.js path: $NodePath" "Gray"
    Write-ColorOutput "Script directory: $ScriptDir" "Gray"
}

function Remove-ExistingTask {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        if ($Force -or $WhatIf) {
            Write-ColorOutput "Removing existing scheduled task..." "Yellow"
            if (-not $WhatIf) {
                Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            }
        } else {
            $response = Read-Host "Scheduled task '$TaskName' already exists. Remove it? (y/N)"
            if ($response -eq 'y' -or $response -eq 'Y') {
                Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            } else {
                Write-ColorOutput "Installation cancelled." "Red"
                exit 1
            }
        }
    }
}

function New-TaskTrigger {
    param($ScheduleConfig)

    # Set default start time if not specified
    $startTime = if ($ScheduleConfig.StartTime) { $ScheduleConfig.StartTime } else { "12:00" }

    if ($ScheduleConfig.DaysOfWeek) {
        # Weekly trigger for work hours
        $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $ScheduleConfig.DaysOfWeek -At $startTime
    } else {
        # Daily trigger
        $trigger = New-ScheduledTaskTrigger -Daily -At $startTime
    }

    return $trigger
}

function Install-ScheduledTask {
    param($ScheduleConfig)
    
    Write-ColorOutput "Creating scheduled task..." "Cyan"
    Write-ColorOutput "Schedule: $($ScheduleConfig.Description)" "Gray"
    
    # Create logs directory
    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
    }
    
    # Create the action
    $actionArgs = "index.js --install-all --install-all-profiles"
    $action = New-ScheduledTaskAction -Execute $NodePath -Argument $actionArgs -WorkingDirectory $ScriptDir
    
    # Create the trigger
    $trigger = New-TaskTrigger $ScheduleConfig
    
    # Create task settings
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    
    # Create the principal (run as current user)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
    
    if ($WhatIf) {
        Write-ColorOutput "WHAT-IF: Would create scheduled task with the following settings:" "Magenta"
        Write-ColorOutput "Task Name: $TaskName" "Gray"
        Write-ColorOutput "Description: $TaskDescription" "Gray"
        Write-ColorOutput "Schedule: $($ScheduleConfig.Description)" "Gray"
        Write-ColorOutput "Command: $NodePath $actionArgs" "Gray"
        Write-ColorOutput "Working Directory: $ScriptDir" "Gray"
        Write-ColorOutput "Log File: $LogFile" "Gray"
        return
    }
    
    # Register the task
    Register-ScheduledTask -TaskName $TaskName -Description $TaskDescription -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    
    Write-ColorOutput "Scheduled task created successfully!" "Green"
}

function Show-Instructions {
    Write-ColorOutput "" "White"
    Write-ColorOutput "Installation Complete!" "Green"
    Write-ColorOutput "Task Name: $TaskName" "White"
    Write-ColorOutput "Schedule: $($Schedules[$Schedule].Description)" "White"
    Write-ColorOutput "Log File: $LogFile" "White"
    Write-ColorOutput "" "White"
    Write-ColorOutput "Management Commands:" "Cyan"
    Write-ColorOutput "View task: Get-ScheduledTask -TaskName '$TaskName'" "Gray"
    Write-ColorOutput "Run manually: Start-ScheduledTask -TaskName '$TaskName'" "Gray"
    Write-ColorOutput "Remove task: Unregister-ScheduledTask -TaskName '$TaskName'" "Gray"
    Write-ColorOutput "View logs: Get-Content '$LogFile' -Tail 20 -Wait" "Gray"
    Write-ColorOutput "" "White"
    Write-ColorOutput "Test the script manually:" "Cyan"
    Write-ColorOutput "cd '$ScriptDir'" "Gray"
    Write-ColorOutput "npm test" "Gray"
    Write-ColorOutput "" "White"
    Write-ColorOutput "Available schedules for reinstallation:" "Cyan"
    foreach ($key in $Schedules.Keys) {
        Write-ColorOutput "$key - $($Schedules[$key].Description)" "Gray"
    }
    Write-ColorOutput "" "White"
    Write-ColorOutput "To change schedule: .\Install-WindowsTask.ps1 -Schedule WorkHours -Force" "Yellow"
}

# Main execution
try {
    Write-ColorOutput "Installing Augment Monitor Windows Scheduled Task..." "Green"
    Write-ColorOutput "" "White"
    
    # Validate schedule parameter
    if (-not $Schedules.ContainsKey($Schedule)) {
        Write-ColorOutput "Error: Invalid schedule '$Schedule'" "Red"
        Write-ColorOutput "Available schedules: $($Schedules.Keys -join ', ')" "Yellow"
        exit 1
    }
    
    Test-Prerequisites
    Remove-ExistingTask
    Install-ScheduledTask $Schedules[$Schedule]
    
    if (-not $WhatIf) {
        Show-Instructions
    }
    
} catch {
    Write-ColorOutput "Installation failed: $($_.Exception.Message)" "Red"
    exit 1
}
