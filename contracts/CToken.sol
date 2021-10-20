// contracts/CToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CToken is ERC20 {

    constructor() ERC20("Collector Token", "CTR") {
        _mint(msg.sender, 10 * (10 ** decimals()));
    }

}
