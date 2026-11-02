# Dot-source this at the start of a Windows test step: `. ./scripts/windows-normal-io.ps1`.
#
# GitHub's Windows runners start each step at low I/O priority, and the browsers the tests launch
# inherit it. Firefox then stalls on its SQLite flushes, so navigations time out
# (https://github.com/microsoft/playwright/issues/43704). Raising this process to normal priority
# raises everything it starts.

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class ProcessIOPriority {
    [DllImport("ntdll.dll")]
    public static extern int NtQueryInformationProcess(
        IntPtr process, int informationClass, out int information, int size, out int length);

    [DllImport("ntdll.dll")]
    public static extern int NtSetInformationProcess(
        IntPtr process, int informationClass, ref int information, int size);
}
'@

# -1 is the current process; 33 is ProcessIoPriority; 2 is normal.
$inherited = 0
$length = 0
$status = [ProcessIOPriority]::NtQueryInformationProcess([IntPtr](-1), 33, [ref]$inherited, 4, [ref]$length)
if ($status -ne 0) { throw ('Reading I/O priority failed: NTSTATUS 0x{0:X8}' -f $status) }

$priority = 2
$status = [ProcessIOPriority]::NtSetInformationProcess([IntPtr](-1), 33, [ref]$priority, 4)
if ($status -ne 0) { throw ('Setting I/O priority failed: NTSTATUS 0x{0:X8}' -f $status) }

Write-Host "I/O priority: $inherited -> $priority"
