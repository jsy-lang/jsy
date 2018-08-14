require('source-map-support').install()
const {basic_offside_scanner} = require('jsy-transpile/cjs/scanner/basic_offside')

describe @ 'Scanners', @=> ::
  describe @ 'Basic Offside Line Scanner', @=> ::

    it @ 'Works with JSY', @=> ::
      // source from https://github.com/shanewholloway/js-consistent-fnvxor32/blob/d2554377c4a540258f93f2958d4259c1f4f03ff9/code/fnvxor32.jsy on 2018-08-09
      basic_offside_scanner @ `
        export function hash_fnv32(sz) ::
          // FNV32, from https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash
          let h = 0x811C9DC5 // fnv-1a 32 bit initial value
          for let i=0; i < sz.length; i++ ::
            h ^= sz.charCodeAt(i)
            h += (h << 24) + (h << 8) + (h << 7) + (h << 4) + (h << 1)
          return h

        export function xor32(h) ::
          // XOR Shift 32, from https://en.wikipedia.org/wiki/Xorshift
          // from Marsaglia, George (July 2003). "Xorshift RNGs". Journal of Statistical Software. 8 (14). doi:10.18637/jss.v008.i14.
          h ^= h << 13
          h ^= h >>> 17
          h ^= h << 5
          return h
        `

    it @ 'Works with Rust-Lang source', @=> ::
      // source from https://doc.rust-lang.org/rust-by-example/flow_control/while.html on 2018-08-09
      basic_offside_scanner @ `
        fn main() ::
            // A counter variable
            let mut n = 1;

            // Loop while 'n' is less than 101
            while n < 101 ::
                if n % 15 == 0 ::
                    println!("fizzbuzz");
                else if n % 3 == 0 ::
                    println!("fizz");
                else if n % 5 == 0 ::
                    println!("buzz");
                else ::
                    println!("{}", n);

                // Increment counter
                n += 1;
        `

    it @ 'Works with Go-Lang source', @=> ::
      // source from https://golang.org/ on 2018-08-09
      basic_offside_scanner @ `
        // A concurrent prime sieve

        package main

        import "fmt"

        // Send the sequence 2, 3, 4, ... to channel 'ch'.
        func Generate(ch chan<- int) ::
          for i := 2; ; i++ ::
            ch <- i // Send 'i' to channel 'ch'.

        // Copy the values from channel 'in' to channel 'out',
        // removing those divisible by 'prime'.
        func Filter(in <-chan int, out chan<- int, prime int) ::
          for ::
            i := <-in // Receive value from 'in'.
            if i%prime != 0 ::
              out <- i // Send 'i' to 'out'.

        // The prime sieve: Daisy-chain Filter processes.
        func main() ::
          ch := make(chan int) // Create a new channel.
          go Generate(ch)      // Launch Generate goroutine.
          for i := 0; i < 10; i++ ::
            prime := <-ch
            fmt.Println(prime)
            ch1 := make(chan int)
            go Filter(ch, ch1, prime)
            ch = ch1
        `

    it @ 'Works with C++ source', @=> ::
      // source from https://en.wikipedia.org/wiki/C%2B%2B on 2018-08-09
      basic_offside_scanner @ `
        #include <iostream>
        #include <vector>
        #include <stdexcept>

        int main() ::
            try ::
                std::vector<int> vec{3, 4, 3, 1};
                int i{vec.at(4)}; // Throws an exception, std::out_of_range (indexing for vec is from 0-3 not 1-4)
            // An exception handler, catches std::out_of_range, which is thrown by vec.at(4)
            catch (std::out_of_range &e) ::
                std::cerr << "Accessing a non-existent element: " << e.what() << '\n';
            // To catch any other standard library exceptions (they derive from std::exception)
            catch (std::exception &e) ::
                std::cerr << "Exception thrown: " << e.what() << '\n';
            // Catch any unrecognised exceptions (i.e. those which don't derive from std::exception)
            catch (...) ::
                std::cerr << "Some fatal error\n";
        `

    it @ 'Works with C# source', @=> ::
      // source from SRCBLAH on 2018-08-09
      basic_offside_scanner @ `
        using System;
        using System.Windows.Forms;

        class Program ::
            static void Main() ::
                MessageBox.Show("Hello, World!");
                Console.WriteLine("Is almost the same argument!");
        `

