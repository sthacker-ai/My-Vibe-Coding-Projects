# Connect to Azure (if not already connected)
try {
    Get-AzContext -ErrorAction Stop
}
catch {
    Connect-AzAccount
}

# Create an empty array to store results
$vmInventory = @()

# Get all subscriptions
$subscriptions = Get-AzSubscription

# Loop through each subscription
foreach ($sub in $subscriptions) {
    # Set context to current subscription
    Set-AzContext -Subscription $sub.Id | Out-Null
    
    Write-Host "Processing subscription: $($sub.Name)" -ForegroundColor Green
    
    # Get all VMs in current subscription
    $vms = Get-AzVM
    
    # Process each VM
    foreach ($vm in $vms) {
        $vmInfo = [PSCustomObject]@{
            SubscriptionName = $sub.Name
            SubscriptionId = $sub.Id
            ResourceGroup = $vm.ResourceGroupName
            VMName = $vm.Name
            Location = $vm.Location
            VMSize = $vm.HardwareProfile.VmSize
            OSType = $vm.StorageProfile.OsDisk.OsType
            PowerState = (Get-AzVM -ResourceGroupName $vm.ResourceGroupName -Name $vm.Name -Status).Statuses[1].DisplayStatus
        }
        
        $vmInventory += $vmInfo
    }
}

# Display results in console
$vmInventory | Format-Table -AutoSize

# Export to CSV (optional)
$dateStamp = Get-Date -Format "yyyyMMdd-HHmm"
$vmInventory | Export-Csv -Path ".\AzureVMInventory-$dateStamp.csv" -NoTypeInformation

Write-Host "`nInventory exported to: AzureVMInventory-$dateStamp.csv" -ForegroundColor Green
