pragma solidity ^0.5.0;

contract Withdraw {


    // Contract owner
    address public owner;


    // Validator withdrawal
    event Withdrawal(address indexed to, uint256 amount, uint256 time);


    /**
     * Can only be called by the contract owner account
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }


    /**
     * Constructor
     */
    constructor() public {
        owner = msg.sender;
    }


    /**
     * Default payable function
     */
    function() public payable {}


    /**
     * Withdraw from Casper
     */
    function withdraw(address payable _to, uint256 _amount) public onlyOwner {

        // Check arguments
        require(_to != address(0x0), "Invalid to address");
        require(_amount > 0, "Invalid withdrawal amount");
        require(_amount <= address(this).balance, "Insufficient contract balance for withdrawal");

        // Transfer withdrawal amount to address
        (bool success,) = _to.call.value(_amount)("");
        require(success, "Unable to withdraw to address");

        // Emit withdrawal event
        emit Withdrawal(_to, _amount, now);

    }


}
